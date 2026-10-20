import { el } from './dom.js';

// Static, trusted SVG path markup (never built from API data).
export const ICONS = {
  events: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/>',
  births: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  deaths: '<path d="M12 3v18M7 8h10"/>',
  holidays: '<path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  inbox: '<path d="M3 4h18v4H3zM4 8h16v12H4zM10 13h4"/>',
};

export function icon(name, size = 18) {
  const span = el('span', 'ico');
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  return span;
}
