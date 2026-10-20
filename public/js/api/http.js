export class ApiError extends Error {
  constructor(status, message, errors = null) {
    super(message);
    this.status = status;
    this.errors = errors; // per-field messages from the server, when present
  }
}

/** fetch + JSON + timeout. Every failure becomes an ApiError so callers handle one shape. */
export async function request(path, { method = 'GET', body, timeoutMs = 12000, signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
  try {
    const res = await fetch(path, {
      method,
      signal: ctrl.signal,
      headers: body ? { 'content-type': 'application/json', accept: 'application/json' } : { accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON body */
    }
    if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status}).`, data?.errors || null);
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, ctrl.signal.aborted ? 'The request took too long.' : 'Could not reach the server.');
  } finally {
    clearTimeout(timer);
  }
}
