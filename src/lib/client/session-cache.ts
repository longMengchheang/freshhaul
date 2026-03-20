export interface SessionCacheEnvelope<T> {
  ts: number;
  data: T;
}

export function readSessionCache<T>(key: string, maxAgeMs: number): T | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionCacheEnvelope<T>;
    if (!parsed || typeof parsed.ts !== 'number') return null;
    if (Date.now() - parsed.ts > maxAgeMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeSessionCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const envelope: SessionCacheEnvelope<T> = {
      ts: Date.now(),
      data,
    };
    window.sessionStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Ignore storage errors silently. Fresh data fetch still works.
  }
}

export function clearSessionCache(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage errors silently.
  }
}

