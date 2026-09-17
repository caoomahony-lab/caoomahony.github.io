import { CHORD_TEMPLATES } from "../theory/chords.js";
import { parseSpelledPitchClass } from "../theory/functions.js";
import { mod12 } from "../theory/pitch.js";

const SUFFIX_TO_TEMPLATE = Object.freeze({
  "": "major",
  "maj": "major",
  "M": "major",
  "m": "minor",
  "min": "minor",
  "-": "minor",
  "5": "power",
  "dim": "diminished",
  "°": "diminished",
  "aug": "augmented",
  "+": "augmented",
  "sus2": "sus2",
  "sus4": "sus4",
  "sus": "sus4",
  "6": "major6",
  "maj6": "major6",
  "m6": "minor6",
  "min6": "minor6",
  "7": "dominant7",
  "maj7": "major7",
  "M7": "major7",
  "Δ7": "major7",
  "m7": "minor7",
  "min7": "minor7",
  "mMaj7": "minorMajor7",
  "mM7": "minorMajor7",
  "m(maj7)": "minorMajor7",
  "m7b5": "halfDiminished7",
  "ø": "halfDiminished7",
  "ø7": "halfDiminished7",
  "dim7": "diminished7",
  "°7": "diminished7",
  "augMaj7": "augmentedMajor7",
  "+maj7": "augmentedMajor7",
  "add9": "add9",
  "madd9": "minorAdd9",
  "m(add9)": "minorAdd9",
  "9": "dominant9",
  "maj9": "major9",
  "M9": "major9",
  "m9": "minor9",
  "min9": "minor9"
});

const TEMPLATE_BY_ID = new Map(CHORD_TEMPLATES.map((template) => [template.id, template]));

function normalizeAccidentals(text) {
  return String(text)
    .replaceAll("♯", "#")
    .replaceAll("♭", "b")
    .replaceAll("−", "-");
}

function normalizeSuffix(raw) {
  const value = normalizeAccidentals(raw).trim();
  if (value in SUFFIX_TO_TEMPLATE) return value;
  const lowerAliases = {
    major: "maj",
    minor: "min",
    diminished: "dim",
    augmented: "aug",
    major7: "maj7",
    minor7: "min7",
    major9: "maj9",
    minor9: "min9"
  };
  return lowerAliases[value.toLowerCase()] ?? value;
}

function templatePitchClasses(rootPc, templateId) {
  const template = TEMPLATE_BY_ID.get(templateId);
  if (!template) throw new RangeError(`Unknown chord template: ${templateId}`);
  return Object.freeze([...new Set(template.intervals.map((interval) => mod12(rootPc + interval)))].sort((a, b) => a - b));
}

export function parseChordSymbol(symbol) {
  const sourceSymbol = String(symbol ?? "").trim();
  if (!sourceSymbol) throw new TypeError("chord symbol must not be empty");
  const normalized = normalizeAccidentals(sourceSymbol).replace(/\s+/g, "");
  const slashIndex = normalized.lastIndexOf("/");
  const chordText = slashIndex >= 0 ? normalized.slice(0, slashIndex) : normalized;
  const bassText = slashIndex >= 0 ? normalized.slice(slashIndex + 1) : null;
  if (slashIndex >= 0 && !bassText) throw new TypeError(`missing slash bass in chord symbol: ${sourceSymbol}`);

  const rootMatch = /^([A-Ga-g])([#b]*)(.*)$/.exec(chordText);
  if (!rootMatch) throw new TypeError(`unsupported chord symbol: ${sourceSymbol}`);
  const rootSpelling = `${rootMatch[1].toUpperCase()}${rootMatch[2]}`;
  const root = parseSpelledPitchClass(rootSpelling);
  const suffix = normalizeSuffix(rootMatch[3]);
  const templateId = SUFFIX_TO_TEMPLATE[suffix];
  if (!templateId) throw new RangeError(`unsupported chord suffix "${rootMatch[3]}" in ${sourceSymbol}`);

  let bassSpelling = null;
  let bassPc = null;
  if (bassText != null) {
    if (!/^[A-Ga-g][#b]*$/.test(bassText)) throw new TypeError(`unsupported slash bass: ${bassText}`);
    bassSpelling = `${bassText[0].toUpperCase()}${bassText.slice(1)}`;
    bassPc = parseSpelledPitchClass(bassSpelling).pitchClass;
  }

  const pitchClasses = templatePitchClasses(root.pitchClass, templateId);
  return Object.freeze({
    sourceSymbol,
    normalizedSymbol: `${rootSpelling}${rootMatch[3]}${bassSpelling ? `/${bassSpelling}` : ""}`,
    rootSpelling,
    rootPc: root.pitchClass,
    suffix: rootMatch[3],
    templateId,
    pitchClasses,
    bassSpelling,
    bassPc,
    bassInChord: bassPc == null ? null : pitchClasses.includes(bassPc),
    evidenceClass: "deterministic"
  });
}

export function parseRegisteredPitch(value) {
  const text = String(value ?? "").trim();
  if (!text) throw new TypeError("registered pitch must not be empty");
  if (/^\d{1,3}$/.test(text)) {
    const midi = Number(text);
    if (!Number.isInteger(midi) || midi < 0 || midi > 127) throw new RangeError(`MIDI pitch outside 0..127: ${text}`);
    return midi;
  }
  const match = /^([A-Ga-g])([#b♯♭]*)(-?\d+)$/.exec(text);
  if (!match) throw new TypeError(`unsupported registered pitch: ${text}`);
  const spelling = normalizeAccidentals(`${match[1].toUpperCase()}${match[2]}`);
  const pitchClass = parseSpelledPitchClass(spelling).pitchClass;
  const octave = Number(match[3]);
  const midi = 12 * (octave + 1) + pitchClass;
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) throw new RangeError(`registered pitch outside MIDI range: ${text}`);
  return midi;
}

export function parseRegisteredVoicing(text) {
  const source = String(text ?? "").trim();
  if (!source) return Object.freeze([]);
  const tokens = source.split(/[\s,]+/).filter(Boolean);
  const midi = tokens.map(parseRegisteredPitch).sort((a, b) => a - b);
  return Object.freeze(midi);
}

export const SUPPORTED_CHORD_SUFFIXES = Object.freeze(Object.keys(SUFFIX_TO_TEMPLATE));
