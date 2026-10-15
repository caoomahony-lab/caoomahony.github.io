export const FEELING_NOTES_KEY = "harmonic-savant:feeling-notes:v1";
const MAX_NOTES = 1000;

function validFeelingNote(note) {
  return note?.version === "feeling-observation-v1" && typeof note.sourceId === "string" && Boolean(note.sourceId.trim()) &&
    !note.sourceId.startsWith("session:") && typeof note.segmentId === "string" && Boolean(note.segmentId) &&
    note.raterType === "user" && note.evidenceClass === "subjective-personal-annotation" &&
    Number.isFinite(note.onsetSeconds) && note.onsetSeconds >= 0 && Number.isFinite(note.endSeconds) && note.endSeconds > note.onsetSeconds &&
    (note.chord === null || typeof note.chord === "string") && typeof note.createdAt === "string" && Number.isFinite(Date.parse(note.createdAt)) &&
    Array.isArray(note.tags) && note.tags.length > 0 && note.tags.length <= 8 &&
    note.tags.every(tag => tag && typeof tag.label === "string" && Boolean(tag.label.trim()) && tag.label.length <= 48 && tag.weight === 1) &&
    new Set(note.tags.map(tag => tag.label)).size === note.tags.length;
}

export function readFeelingNotes(storage, { strict = false } = {}) {
  try {
    if (strict && !storage) throw new Error("Local storage is unavailable.");
    const notes = JSON.parse(storage?.getItem(FEELING_NOTES_KEY) || "[]");
    if (strict && (!Array.isArray(notes) || !notes.every(validFeelingNote))) throw new Error("Saved feeling notes contain unsupported data.");
    return Array.isArray(notes) ? notes.filter(validFeelingNote) : [];
  } catch (error) { if (strict) throw error; return []; }
}

export function saveFeelingNote(storage, song, selectedIndex, text) {
  const region = song?.regions?.[selectedIndex];
  if (!Number.isInteger(selectedIndex) || !region || typeof song.sourceId !== "string" || !song.sourceId.trim() || song.sourceId.startsWith("session:") ||
    !Number.isFinite(region.onset) || region.onset < 0 || !Number.isFinite(region.end) || region.end <= region.onset) throw new Error("A stable song identity and valid song moment are required before saving a note.");
  const labels = [...new Set(String(text).split(",").map(label => label.trim()).filter(Boolean))];
  if (!labels.length || labels.length > 8 || labels.some(label => label.length > 48)) throw new Error("Enter 1–8 comma-separated feelings, each up to 48 characters.");
  const segmentId = `${selectedIndex}:${region.onset}:${region.end}`;
  const note = { version: "feeling-observation-v1", sourceId: song.sourceId, segmentId,
    onsetSeconds: region.onset, endSeconds: region.end, chord: region.symbol || null,
    tags: labels.map(label => ({ label, weight: 1 })), raterType: "user",
    evidenceClass: "subjective-personal-annotation", createdAt: new Date().toISOString(),
    songProgressionVersion: song.version || null, interpretationEvidenceClass: song.evidenceClass || null };
  if (!storage) throw new Error("Local storage is unavailable.");
  let stored;
  try { stored = JSON.parse(storage.getItem(FEELING_NOTES_KEY) || "[]"); }
  catch { throw new Error("Saved feeling notes could not be read. Existing data was preserved."); }
  if (!Array.isArray(stored) || !stored.every(validFeelingNote)) throw new Error("Saved feeling notes contain unsupported data. Existing data was preserved.");
  const notes = stored.filter(item => item.sourceId !== song.sourceId || item.segmentId !== segmentId);
  if (notes.length >= MAX_NOTES) throw new Error("The 1,000-note limit was reached. Existing notes were preserved; you can still update a saved moment or export.");
  notes.push(note);
  storage.setItem(FEELING_NOTES_KEY, JSON.stringify(notes));
  return note;
}
