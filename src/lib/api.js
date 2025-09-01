export const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
const rawKey = (import.meta.env.VITE_API_KEY ?? '').trim();
export const API_KEY = rawKey;

function toError(err, fallbackMsg='Error de red') {
  if (err?.name === 'AbortError') return new Error('timeout');
  if (typeof err === 'string') return new Error(err);
  if (err instanceof Error) return err;
  try { return new Error(String(err?.message || fallbackMsg)); } catch { return new Error(fallbackMsg); }
}

export async function api(path, { method='GET', body, signal, headers={}, timeoutMs=20000 } = {}) {
  const url = `${API_BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const reqHeaders = { ...headers };
  if (body !== undefined) reqHeaders['Content-Type'] = 'application/json';
  if (API_KEY) reqHeaders['x-api-key'] = API_KEY;

  try {
    const res = await fetch(url, { method, headers: reqHeaders, body: body!==undefined?JSON.stringify(body):undefined, signal: signal||controller.signal });
    const text = await res.text();
    let data = {}; try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || '(empty)' }; }
    if (!res.ok) throw new Error(data?.detail || data?.error || `HTTP ${res.status}`);
    return data;
  } catch (e) {
    throw toError(e);
  } finally {
    clearTimeout(timer);
  }
}
