// Vercel entry: wraps the Express app as a serverless function.
import { config, assertProductionConfig } from '../server/config.js';
import { createApp } from '../server/app.js';
import { createWikipedia } from '../server/services/wikipedia.js';
import { createMongoStore } from '../server/stores/mongoStore.js';
import { createMemoryStore } from '../server/stores/memoryStore.js';

let appPromise;

async function init() {
  assertProductionConfig();
  const store = config.mongoUri ? await createMongoStore(config.mongoUri) : createMemoryStore();
  const wikipedia = createWikipedia({ ttlMs: config.historyTtlMs, contact: config.wikiContact });
  return createApp({ store, wikipedia, config });
}

export default async function handler(req, res) {
  try {
    appPromise ??= init();
    const app = await appPromise;
    return app(req, res);
  } catch (err) {
    appPromise = undefined; // retry init on next request
    console.error('[init] failed:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Server failed to start. Check environment variables.' }));
  }
}