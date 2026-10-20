import { createHash } from 'node:crypto';
import helmet from 'helmet';

/** sha256 of every inline <script> body (the import map), so CSP can allow exactly those and nothing else. */
export function inlineScriptHashes(htmlPages) {
  const hashes = new Set();
  for (const html of htmlPages) {
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
      hashes.add(createHash('sha256').update(m[1]).digest('base64'));
    }
  }
  return [...hashes];
}

export function securityHeaders({ hashes, isProd }) {
  const directives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", ...hashes.map((h) => `'sha256-${h}'`)],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https://*.wikimedia.org'],
    fontSrc: ["'self'"],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  };
  if (isProd) directives.upgradeInsecureRequests = [];
  return helmet({
    contentSecurityPolicy: { useDefaults: false, directives },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}
