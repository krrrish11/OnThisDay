// Small DOM helpers shared by every page. Content is always set with textContent, never innerHTML.

export const $ = (id) => document.getElementById(id);

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fade/slide a freshly rendered block in. Skipped for reduced motion. */
export function animateIn(node) {
  if (prefersReducedMotion() || !node.animate) return;
  node.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], {
    duration: 300,
    easing: 'cubic-bezier(.22,.8,.3,1)',
  });
}

/** Append `text` to `parent`, wrapping every case-insensitive match of `q` (already lower-cased) in <mark>. */
export function highlight(parent, text, q) {
  if (!q) {
    parent.textContent = text;
    return;
  }
  const low = text.toLowerCase();
  let i = 0;
  let at;
  while ((at = low.indexOf(q, i)) !== -1) {
    parent.append(text.slice(i, at), el('mark', null, text.slice(at, at + q.length)));
    i = at + q.length;
  }
  parent.append(text.slice(i));
}

const isWikiHost = (h) => h === 'wikipedia.org' || h.endsWith('.wikipedia.org');
const isMediaHost = (h) => isWikiHost(h) || h === 'wikimedia.org' || h.endsWith('.wikimedia.org');

function safe(value, hostOk) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && hostOk(u.hostname) ? u.href : null;
  } catch {
    return null;
  }
}
export const safePageUrl = (v) => safe(v, isWikiHost);
export const safeImageUrl = (v) => safe(v, isMediaHost);

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
