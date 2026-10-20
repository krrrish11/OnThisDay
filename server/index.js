import { config, assertProductionConfig } from './config.js';
import { createApp } from './app.js';
import { createWikipedia } from './services/wikipedia.js';
import { createMongoStore } from './stores/mongoStore.js';
import { createMemoryStore } from './stores/memoryStore.js';

assertProductionConfig();

const store = config.mongoUri ? await createMongoStore(config.mongoUri) : createMemoryStore();
if (store.kind === 'memory') {
  console.warn('[store] MONGO_URI is not set: visitor notes are kept in memory and will be lost on restart.');
}
const wikipedia = createWikipedia({ ttlMs: config.historyTtlMs, contact: config.wikiContact });
const app = createApp({ store, wikipedia, config });

const server = app.listen(config.port, () => {
  console.log(`On This Day listening on ${config.siteUrl} (port ${config.port}, store: ${store.kind})`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
