// Presentation adapter over the existing score/audio region models. No new chord inference.
export const SONG_PROGRESSION_VERSION = "song-progression-v1";

export function regionIndexAt(regions, time, { includeFinalEndpoint = false } = {}) {
  if (!Number.isFinite(time) || !Array.isArray(regions)) return -1;
  let low = 0, high = regions.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (regions[mid].onset <= time) low = mid + 1;
    else high = mid - 1;
  }
  // Prefer the latest onset at shared boundaries. Audio frame arithmetic can
  // leave the previous end a few floating-point units beyond the next onset.
  if (high >= 0 && time < regions[high].end) return high;
  const last = regions.at(-1);
  return includeFinalEndpoint && last && Math.abs(time - last.end) < 1e-9 ? regions.length - 1 : -1;
}

export function createSongProgression({ scoreHarmony, audioHarmony, sourceId, title, generation, duration } = {}) {
  const score = Boolean(scoreHarmony?.regions?.length);
  const raw = score ? scoreHarmony.regions : audioHarmony?.regions?.length ? audioHarmony.regions : audioHarmony?.segments || [];
  let previousEnd = -Infinity;
  const regions = raw.map((region, index) => {
    if (!region || !Number.isFinite(region.onset) || region.onset < 0 || !Number.isFinite(region.end) || region.end <= region.onset || region.onset < previousEnd - 1e-9) {
      throw new TypeError("Song regions must be ordered, nonoverlapping sounding intervals");
    }
    previousEnd = region.end;
    return Object.freeze({ index, onset: region.onset, end: region.end, symbol: region.symbol || null,
      rootPc: region.rootPc ?? null, templateId: region.templateId ?? null, pcs: Object.freeze([...(region.pcs || region.measuredPitchClasses || [])]),
      candidates: Object.freeze((region.candidates || []).slice(0, 6).map(candidate => Object.freeze({
        symbol: candidate.symbol, rootPc: candidate.rootPc, templateId: candidate.templateId, support: candidate.support ?? candidate.regionSupport ?? null
      }))), evidenceClass: score ? "measured-notes-inferred-chords" : "inferred-audio-chords" });
  });
  return Object.freeze({ version: SONG_PROGRESSION_VERSION, sourceId: sourceId || `session:${generation}`,
    title: String(title || "Current song"), generation, duration: Number(duration) || regions.at(-1)?.end || 0,
    evidenceClass: score ? "measured-notes-inferred-chords" : "inferred-audio-chords", regions: Object.freeze(regions) });
}

// Only contiguous resolved history through the selection; never include the song's future.
export function progressionThroughSelection(song, selectedIndex, { symbolOverride = null, limit = 16 } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 256) throw new RangeError("History limit must be an integer from 1 to 256");
  if (!Number.isInteger(selectedIndex) || !song?.regions?.[selectedIndex]) throw new RangeError("Select a sounding song region");
  const selected = song.regions[selectedIndex];
  if (!symbolOverride && (!selected.symbol || selected.rootPc == null || !selected.templateId)) {
    return { progression: null, startIndex: selectedIndex, endIndex: selectedIndex, reason: "The selected chord is unresolved. Choose an interpretation or use manual progression mode." };
  }
  const symbols = [symbolOverride || selected.symbol];
  let startIndex = selectedIndex;
  for (let i = selectedIndex - 1; i >= Math.max(0, selectedIndex - limit + 1); i--) {
    const region = song.regions[i], next = song.regions[i + 1];
    if (!region.symbol || region.rootPc == null || !region.templateId || next.onset - region.end > 1e-9) break;
    symbols.unshift(region.symbol); startIndex = i;
  }
  return Object.freeze({ progression: symbols.join(" | "), startIndex, endIndex: selectedIndex,
    evidenceClass: symbolOverride ? "user-selected-chord-interpretation" : song.evidenceClass });
}
