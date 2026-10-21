# On This Day

Explore history one date at a time. Wikipedia "On This Day" data, a 3D watch-dial date picker, and a visitor wall stored in MongoDB.

## Run locally
```bash
npm install
cp .env.example .env     # optional; without MONGO_URI notes are kept in memory only
npm run dev              # http://localhost:3000
npm test                 # API and page tests
```

## Structure
- `server/` Express app: `routes/` (history proxy, visitors), `services/wikipedia.js` (cache, dedupe, stale fallback), `stores/` (Mongo or memory), `middleware/` (CSP, rate limit, admin, errors)
- `/entry` details page: Wikipedia summaries per linked article via `GET /api/summary/:title` (cached 24h), facts, same-year entries, previous/next
- `views/` HTML pages with shared `partials/` (header, footer)
- `public/css`, `public/js` (core, api, components, pages), self-hosted fonts; three.js served from `node_modules`

## Environment
| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection (required in production) |
| `SITE_URL` | Public URL for canonical, sitemap, OG (required in production) |
| `ADMIN_TOKEN` | Enables `DELETE /api/visitors/:id` with `Authorization: Bearer <token>`; unset = endpoint hidden |
| `TRUST_PROXY` | `1` behind Render-style proxies so rate limits see real IPs |
| `PORT`, `HISTORY_TTL_HOURS`, `VISITOR_POSTS_PER_HOUR`, `WIKI_CONTACT` | Optional tuning |

## Deploy (Render + MongoDB Atlas)
1. Atlas: create a free M0 cluster, a database user, allow network access (0.0.0.0/0 for Render free tier). Copy the connection string.
2. Push this folder to a GitHub repo.
3. Render: New > Blueprint, pick the repo (uses `render.yaml`). Set `MONGO_URI` and `SITE_URL`.
4. Open `/api/health`; it should report `"store":"mongo"`.
5. Custom domain: Render > Settings > Custom Domains, add the CNAME at your DNS provider. HTTPS is automatic.
6. Set `SITE_URL` to the final domain and redeploy.
7. Moderation: `curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" https://your-site/api/visitors/<id>`
8. Analytics (optional): Plausible/Umami need a script tag plus a CSP `script-src` addition in `server/middleware/security.js`. None is included, so visitors stay untracked.

## Notes
- The Mongo store was not run against a live database in the build sandbox; check step 4 after deploy.
- Render free instances sleep when idle, so the first request can take ~30s.
