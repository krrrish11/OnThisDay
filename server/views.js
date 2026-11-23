import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Tiny server-side includes, so the navbar and footer live in one file each.
 *   {{> header}}        -> views/partials/header.html
 *   {{current:explore}} -> aria-current="page" when rendering the Explore page
 *   {{var:name}}        -> a value supplied by the route, HTML-escaped
 *   {{html:name}}       -> markup built by the server itself (never user text)
 *   {{siteUrl}} {{year}}
 */
export const escapeHtml = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createRenderer({ viewsDir, siteUrl, cache }) {
  const files = new Map();
  const read = (rel) => {
    if (cache && files.has(rel)) return files.get(rel);
    const text = readFileSync(join(viewsDir, rel), 'utf8');
    files.set(rel, text);
    return text;
  };

  return function render(view, { page = view, vars = {}, html = {} } = {}) {
    return read(`${view}.html`)
      .replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => read(`partials/${name}.html`))
      .replace(/\{\{current:(\w+)\}\}/g, (_, name) => (name === page ? 'aria-current="page"' : ''))
      .replace(/\{\{var:(\w+)\}\}/g, (_, k) => escapeHtml(vars[k] ?? ''))
      .replace(/\{\{html:(\w+)\}\}/g, (_, k) => html[k] ?? '')
      .replace(/\{\{siteUrl\}\}/g, siteUrl)
      .replace(/\{\{year\}\}/g, String(new Date().getFullYear()));
  };
}
