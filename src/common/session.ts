/**
 * sessionStorage, guarded: it can be absent, full, or throw on read in a private window.
 * A value that cannot be read is read as nothing; one that cannot be written is said so.
 */

export function readSession<T>(key: string): T | null {
  try {
    const text = sessionStorage.getItem(key);
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: unknown): boolean {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Only when there: removing what is not there is still a write, on every page. */
export function removeSession(key: string): void {
  try {
    if (sessionStorage.getItem(key) !== null) sessionStorage.removeItem(key);
  } catch {}
}
