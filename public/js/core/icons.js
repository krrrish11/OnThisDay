import { el } from './dom.js';

// Static, trusted SVG path markup (never built from API data).
export const ICONS = {
  events: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/>',
  births: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  deaths: '<path d="M12 3v18M7 8h10"/>',
  holidays: '<path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  inbox: '<path d="M3 4h18v4H3zM4 8h16v12H4zM10 13h4"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="1.8"/><path d="M21 16l-5-5-8 8"/>',
  pin: '<path d="M12 21s-6-5.6-6-10.5a6 6 0 1112 0C18 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
};

export function icon(name, size = 18) {
  const span = el('span', 'ico');
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  return span;
}
