# On This Day

Explore history one date at a time. Wikipedia "On This Day" data, a 3D watch-dial date picker, and a notes Wall (public or private notes with optional photos, optional accounts) stored in MongoDB.

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
| `SESSION_SECRET` | Signs the login cookie. **Required in production**; if missing, accounts and private notes switch off and guests still work |
| `ADMIN_TOKEN` (or `ADMIN_KEY`) | Enables `/admin` and `/api/admin/*` with `Authorization: Bearer <token>`; unset = hidden |
| `NOTE_POSTS_PER_HOUR` | Notes per hour per IP and per user (default 10) |
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

## Notes, accounts and limits
- Pages: `/` (On This Day + your memories for today), `/wall` (search, date filter, 20 per page), `/add`, `/n/:id` (share page), `/my-notes`, `/login`, `/admin`.
- Note: up to 2000 chars, a date (1900 to tomorrow), optional name, one optional photo (JPEG, shrunk in the browser to ~1280px, server limit 300 KB / 2000px). IDs are 6 characters without 0/O/1/I.
- Guests get a delete key (shown once, kept in localStorage, only its hash is stored). Logged-in users delete from their account. Private notes need a login and return 404 to everyone else.
- Rate limit: 10 notes/hour per IP and per user, stored in the database (hashed, auto-expires) so it holds across serverless instances.
- Security: server-side validation, text rendered with `textContent`, strict CSP, same-origin check on writes, bcrypt passwords, httpOnly SameSite cookie.
- Logout clears the cookie but sessions are stateless, so a stolen cookie stays valid until it expires (30 days). Rotating `SESSION_SECRET` signs everyone out.

### Storage and upgrade path
Photos are stored inside MongoDB (about 100-300 KB each). The Atlas free tier (512 MB) holds roughly 1,000 to 2,500 photo notes, and far more text-only notes. When you outgrow it, move photos to object storage (Vercel Blob, S3 or Cloudflare R2): store the URL in the note instead of the bytes and serve `/api/notes/:id/photo` as a redirect. Search is a case-insensitive match per word; for large volumes add an Atlas Search or text index.
