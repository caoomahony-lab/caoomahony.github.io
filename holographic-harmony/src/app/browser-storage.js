export function browserStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}
