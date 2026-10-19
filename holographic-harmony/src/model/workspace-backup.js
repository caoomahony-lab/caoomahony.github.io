export const WORKSPACE_BACKUP_VERSION = "harmonic-workspace-backup-v1";
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const prefix = "harmonic-savant:";
function requireStorage(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") throw new Error("Browser storage is unavailable");
}
function validate(value) {
  if (value?.version !== WORKSPACE_BACKUP_VERSION || !Array.isArray(value.records) || value.records.length > 128) throw new TypeError("Unsupported workspace backup");
  const keys = new Set();
  for (const item of value.records) {
    if (!item || typeof item.key !== "string" || !item.key.startsWith(prefix) || item.key.length > 160 || typeof item.value !== "string" || keys.has(item.key)) throw new TypeError("Invalid, foreign or duplicate backup record");
    keys.add(item.key);
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_BACKUP_BYTES) throw new RangeError("Workspace backup exceeds 20 MiB");
  return value;
}
export function exportWorkspace(storage) {
  requireStorage(storage);
  const records = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (typeof key === "string" && key.startsWith(prefix)) {
      const value = storage.getItem(key);
      if (value !== null) records.push({ key, value });
    }
  }
  records.sort((a,b) => a.key.localeCompare(b.key));
  return validate({ version: WORKSPACE_BACKUP_VERSION, createdAt: new Date().toISOString(), records,
    note: "Exact local application records, including unfamiliar formats. Original music files are not included. Keep those separately. This backup may contain personal annotations; it is never uploaded by the app." });
}
export function restoreWorkspace(storage, input) {
  requireStorage(storage);
  if (typeof input === "string" && new TextEncoder().encode(input).length > MAX_BACKUP_BYTES) throw new RangeError("Workspace backup exceeds 20 MiB");
  const backup = validate(typeof input === "string" ? JSON.parse(input) : input);
  const additions = [];
  for (const record of backup.records) {
    const existing = storage.getItem(record.key);
    if (existing !== null && existing !== record.value) throw new Error(`Restore conflict at ${record.key}. Existing work was preserved. Restore into an empty browser profile or export its backup first.`);
    if (existing === null) additions.push(record);
  }
  const written = [];
  try {
    for (const record of additions) { storage.setItem(record.key, record.value); written.push(record.key); }
  } catch (error) {
    const rollbackErrors = [];
    for (const key of written.reverse()) { try { storage.removeItem(key); } catch { rollbackErrors.push(key); } }
    throw new Error(`Restore failed: ${error.message}. ${rollbackErrors.length ? "Some new records could not be removed; keep your backup and inspect storage before retrying." : "New records were rolled back; existing work was preserved."}`);
  }
  return { restored: additions.length, unchanged: backup.records.length - additions.length };
}
