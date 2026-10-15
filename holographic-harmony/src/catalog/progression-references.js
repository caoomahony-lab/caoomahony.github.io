import { parseChordSymbol } from "../input/chord-symbols.js";

export const PROGRESSION_REFERENCE_VERSION = "curated-progression-references-v1";
// Short, source-attributed chord skeletons, transposed to C for comparison.
// These are not complete scores or a statistical recommendation corpus.
export const PROGRESSION_REFERENCES = Object.freeze([
  { id: "u2-with-or-without-you", title: "With or Without You", artist: "U2", section: "core loop",
    chords: ["C", "G", "Am", "F"], tags: ["Simple", "Classic", "Bright"],
    url: "https://www.hooktheory.com/theorytab/view/u2/with-or-without-you" },
  { id: "beatles-let-it-be", title: "Let It Be", artist: "The Beatles", section: "opening verse skeleton",
    chords: ["C", "G", "Am", "F"], tags: ["Mellow", "Bright"],
    url: "https://www.hooktheory.com/theorytab/view/the-beatles/let-it-be" },
  { id: "radiohead-creep", title: "Creep", artist: "Radiohead", section: "verse loop",
    chords: ["C", "E", "F", "Fm"], tags: ["Tense", "Unexpected", "Bright"],
    url: "https://www.hooktheory.com/theorytab/view/radiohead/creep" },
  { id: "ben-e-king-stand-by-me", title: "Stand By Me", artist: "Ben E. King", section: "core loop",
    chords: ["C", "Am", "F", "G"], tags: ["Tense", "Simple", "Classic", "Bright"],
    url: "https://www.hooktheory.com/theorytab/view/ben-e-king/stand-by-me" },
  { id: "hollies-air-that-i-breathe", title: "The Air That I Breathe", artist: "The Hollies", section: "shared chromatic pattern",
    chords: ["C", "E", "F", "Fm", "C"], tags: [],
    url: "https://www.hooktheory.com/blog/whose-hook-is-it-anyway/" }
].map(reference => Object.freeze({ ...reference, chords: Object.freeze(reference.chords), tags: Object.freeze(reference.tags),
  source: "Hooktheory / TheoryTab", evidenceClass: "curated-source-attributed-chord-skeleton",
  tagProvenance: "Source page descriptors; rater and validation method unspecified. Subjective, not an emotion prediction." })));

function chordShape(chord) {
  if (!chord || !Number.isInteger(chord.rootPc) || chord.rootPc < 0 || chord.rootPc > 11 || typeof chord.templateId !== "string" || !chord.templateId) return null;
  const id = chord.templateId;
  const quality = /^(major|dominant|add9)/.test(id) ? "major" : /^minor/.test(id) ? "minor" : id;
  return { root: chord.rootPc, quality };
}
const shapes = reference => reference.chords.map(symbol => chordShape(parseChordSymbol(symbol)));
const mod12 = value => ((value % 12) + 12) % 12;

export function matchProgressionReferences(regions, { references = PROGRESSION_REFERENCES, minimumChords = 3 } = {}) {
  if (!Array.isArray(regions)) throw new TypeError("regions must be an array");
  if (!Number.isInteger(minimumChords) || minimumChords < 3) throw new RangeError("At least three ordered chords are required");
  // Collapse adjacent holds only; unresolved labels and rests remain barriers.
  const sequence = [];
  for (let index = 0; index < regions.length; index++) {
    const region = regions[index], shape = chordShape(region), previous = sequence.at(-1);
    const gap = index > 0 && Number.isFinite(region?.onset) && region.onset - regions[index - 1]?.end > 1e-9;
    if (gap) sequence.push(null);
    if (!shape) { sequence.push(null); continue; }
    if (!gap && previous && previous.root === shape.root && previous.quality === shape.quality) previous.endIndex = index;
    else sequence.push({ ...shape, startIndex: index, endIndex: index });
  }
  const matches = [];
  for (const reference of references) {
    const pattern = shapes(reference);
    let best = null;
    for (let i = 0; i < sequence.length; i++) for (let j = 0; j < pattern.length; j++) {
      if (!sequence[i]) continue;
      const shift = mod12(sequence[i].root - pattern[j].root);
      let length = 0;
      while (i + length < sequence.length && j + length < pattern.length) {
        const a = sequence[i + length], b = pattern[j + length];
        if (!a || a.quality !== b.quality || mod12(a.root - b.root) !== shift) break;
        length++;
      }
      if (length >= minimumChords && (!best || length > best.length)) best = {
        reference, kind: "ordered-chord-skeleton", length, shift,
        startIndex: sequence[i].startIndex, endIndex: sequence[i + length - 1].endIndex,
        referenceStart: j, referenceEnd: j + length - 1,
        note: "Contiguous chord skeleton under one transposition. Extensions, inversions, timing and repeated holds are ignored; this is not whole-song similarity."
      };
    }
    if (best) matches.push(best);
  }
  return matches.sort((a, b) => b.length - a.length || a.reference.id.localeCompare(b.reference.id)).slice(0, 4);
}

export function sharedProgressionDevices(regions, { references = PROGRESSION_REFERENCES } = {}) {
  if (!Array.isArray(regions)) throw new TypeError("regions must be an array");
  const changes = [];
  for (let i = 1; i < regions.length; i++) {
    const a = chordShape(regions[i - 1]), b = chordShape(regions[i]);
    if (!a || !b || a.root !== b.root || a.quality === b.quality ||
      ![a.quality, b.quality].every(quality => ["major", "minor"].includes(quality)) ||
      (Number.isFinite(regions[i].onset) && regions[i].onset - regions[i - 1].end > 1e-9)) continue;
    for (const reference of references) {
      const pattern = shapes(reference);
      const index = pattern.findIndex((shape, j) => j > 0 && shape.root === pattern[j - 1].root && shape.quality !== pattern[j - 1].quality);
      if (index > 0) changes.push({ reference, kind: "shared-device", startIndex: i - 1, endIndex: i,
        sameDirection: a.quality === pattern[index - 1].quality,
        note: `Same-root major/minor change${a.quality === pattern[index - 1].quality ? "" : " in the opposite direction"}. A shared device, not an identical progression.` });
    }
  }
  return changes.filter((item, index, all) => all.findIndex(other => other.reference.id === item.reference.id) === index).slice(0, 3);
}
