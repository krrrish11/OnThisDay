import { $ } from './dom.js';

/** Show (or clear) the message under a field and mark the input invalid for screen readers. */
export function setError(field, text, errId = `${field}-err`) {
  const err = $(errId);
  if (err) err.textContent = text || '';
  const input = $(field);
  if (input) text ? input.setAttribute('aria-invalid', 'true') : input.removeAttribute('aria-invalid');
}

export function showStatus(node, kind, text) {
  node.className = `form-status${kind ? ` ${kind}` : ''}`;
  node.textContent = text || '';
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
