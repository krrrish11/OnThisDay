import express from 'express';
import compression from 'compression';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRenderer } from './views.js';
import { inlineScriptHashes, securityHeaders } from './middleware/security.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { apiNotFound, errorHandler } from './middleware/errors.js';
import { historyRouter } from './routes/history.js';
import { visitorsRouter } from './routes/visitors.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = { '/': 'index', '/visitors': 'visitors', '/about': 'about' };

const parseTrustProxy = (v) => (v === 'true' ? true : v === 'false' ? false : /^\d+$/.test(String(v)) ? Number(v) : v);

export function createApp({ store, wikipedia, config }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);

  const render = createRenderer({ viewsDir: join(ROOT, 'views'), siteUrl: config.siteUrl, cache: config.isProd });
  const hashes = inlineScriptHashes([...Object.values(PAGES), '404'].map((v) => render(v)));

  app.use(securityHeaders({ hashes, isProd: config.isProd }));
  app.use(compression());

  // three.js is served from our own origin (no CDN), only the folders the dial imports.
  const longCache = { maxAge: '30d', immutable: true };
  app.use('/vendor/three/build', express.static(join(ROOT, 'node_modules/three/build'), longCache));
  app.use('/vendor/three/examples/jsm', express.static(join(ROOT, 'node_modules/three/examples/jsm'), longCache));

  app.use(
    express.static(join(ROOT, 'public'), {
      setHeaders(res, file) {
        if (file.endsWith('.woff2')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else res.setHeader('Cache-Control', 'no-cache'); // always revalidate (ETag) so deploys show up at once
      },
    }),
  );

  // ---- API ----
  app.use('/api', apiLimiter);
  app.get('/api/health', (_req, res) => {
    const ok = store.ping();
    res.status(ok ? 200 : 503).json({ ok, store: store.kind, uptime: Math.round(process.uptime()) });
  });
  app.use('/api/history', historyRouter({ wikipedia }));
  app.use('/api/visitors', visitorsRouter({ store, adminToken: config.adminToken, postsPerHour: config.visitorPostLimit }));
  app.use('/api', apiNotFound);

  // ---- Pages ----
  for (const [route, view] of Object.entries(PAGES)) {
    app.get(route, (_req, res) => res.set('Cache-Control', 'no-cache').type('html').send(render(view)));
  }
  app.get('/robots.txt', (_req, res) =>
    res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${config.siteUrl}/sitemap.xml\n`),
  );
  app.get('/sitemap.xml', (_req, res) => {
    const urls = Object.keys(PAGES).map((p) => `  <url><loc>${config.siteUrl}${p === '/' ? '/' : p}</loc></url>`).join('\n');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  });
  app.use((_req, res) => res.status(404).set('Cache-Control', 'no-cache').type('html').send(render('404')));

  app.use(errorHandler);
  return app;
}
