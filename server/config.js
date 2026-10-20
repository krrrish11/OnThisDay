import 'dotenv/config';

const env = process.env;
const isProd = env.NODE_ENV === 'production';
const port = Number(env.PORT) || 3000;

export const config = {
  isProd,
  port,
  mongoUri: env.MONGO_URI || '',
  siteUrl: (env.SITE_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
  adminToken: env.ADMIN_TOKEN || '',
  trustProxy: env.TRUST_PROXY ?? (isProd ? '1' : 'false'),
  historyTtlMs: (Number(env.HISTORY_TTL_HOURS) || 6) * 3600 * 1000,
  wikiContact: env.WIKI_CONTACT || env.SITE_URL || 'https://github.com/krrrish11',
  visitorPostLimit: Number(env.VISITOR_POSTS_PER_HOUR) || 5,
};

export function assertProductionConfig() {
  if (!isProd) return;
  const missing = [];
  if (!config.mongoUri) missing.push('MONGO_URI');
  if (!env.SITE_URL) missing.push('SITE_URL');
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}
