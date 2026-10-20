import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Tiny server-side includes, so the navbar and footer live in one file each.
 *   {{> header}}        -> views/partials/header.html
 *   {{current:explore}} -> aria-current="page" when rendering the Explore page
 *   {{siteUrl}} {{year}}
 */
export function createRenderer({ viewsDir, siteUrl, cache }) {
  const files = new Map();
  const read = (rel) => {
    if (cache && files.has(rel)) return files.get(rel);
    const text = readFileSync(join(viewsDir, rel), 'utf8');
    files.set(rel, text);
    return text;
  };

  return function render(view, { page = view } = {}) {
    return read(`${view}.html`)
      .replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => read(`partials/${name}.html`))
      .replace(/\{\{current:(\w+)\}\}/g, (_, name) => (name === page ? 'aria-current="page"' : ''))
      .replace(/\{\{siteUrl\}\}/g, siteUrl)
      .replace(/\{\{year\}\}/g, String(new Date().getFullYear()));
  };
}
