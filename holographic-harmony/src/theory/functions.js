import { mod12 } from "./pitch.js";

const NATURAL_PC = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });
const LETTERS = Object.freeze(["C", "D", "E", "F", "G", "A", "B"]);
const ROMANS = Object.freeze(["I", "II", "III", "IV", "V", "VI", "VII"]);

export const CHROMATIC_DEGREES = Object.freeze([
  { semitones: 0, degreeNumber: 1, accidental: 0, label: "1" },
  { semitones: 1, degreeNumber: 2, accidental: -1, label: "b2" },
  { semitones: 2, degreeNumber: 2, accidental: 0, label: "2" },
  { semitones: 3, degreeNumber: 3, accidental: -1, label: "b3" },
  { semitones: 4, degreeNumber: 3, accidental: 0, label: "3" },
  { semitones: 5, degreeNumber: 4, accidental: 0, label: "4" },
  { semitones: 6, degreeNumber: 4, accidental: 1, label: "#4/b5" },
  { semitones: 7, degreeNumber: 5, accidental: 0, label: "5" },
  { semitones: 8, degreeNumber: 6, accidental: -1, label: "b6" },
  { semitones: 9, degreeNumber: 6, accidental: 0, label: "6" },
  { semitones: 10, degreeNumber: 7, accidental: -1, label: "b7" },
  { semitones: 11, degreeNumber: 7, accidental: 0, label: "7" }
]);

const MINOR_QUALITIES = new Set(["minor", "minor7", "minor6", "minor9", "minorAdd9", "minorMajor7"]);
const DIM_QUALITIES = new Set(["diminished", "diminished7"]);
const HALF_DIM_QUALITIES = new Set(["halfDiminished7"]);
const AUG_QUALITIES = new Set(["augmented", "augmentedMajor7"]);
const QUALITY_SUFFIX = Object.freeze({
  power: "5", major: "", minor: "m", diminished: "dim", augmented: "aug", sus2: "sus2", sus4: "sus4",
  major6: "6", minor6: "m6", dominant7: "7", major7: "maj7", minor7: "m7", minorMajor7: "m(maj7)",
  halfDiminished7: "m7b5", diminished7: "dim7", augmentedMajor7: "aug(maj7)", add9: "add9", minorAdd9: "m(add9)",
  dominant9: "9", major9: "maj9", minor9: "m9"
});

export function degreeDescriptor(relativeSemitones) { return CHROMATIC_DEGREES[mod12(relativeSemitones)]; }

function accidentalPrefix(accidental) {
  if (accidental < 0) return "b".repeat(-accidental);
  if (accidental > 0) return "#".repeat(accidental);
  return "";
}

function romanQuality(baseRoman, quality) {
  if (MINOR_QUALITIES.has(quality)) return baseRoman.toLowerCase();
  if (DIM_QUALITIES.has(quality)) return `${baseRoman.toLowerCase()}°`;
  if (HALF_DIM_QUALITIES.has(quality)) return `${baseRoman.toLowerCase()}ø`;
  if (AUG_QUALITIES.has(quality)) return `${baseRoman}+`;
  return baseRoman;
}

function extensionSuffix(quality) {
  const map = {
    dominant7: "7", major7: "maj7", minor7: "7", minorMajor7: "maj7", halfDiminished7: "7", diminished7: "7",
    augmentedMajor7: "maj7", major6: "6", minor6: "6", add9: "add9", minorAdd9: "add9", dominant9: "9", major9: "maj9", minor9: "9",
    sus2: "sus2", sus4: "sus4", power: "5"
  };
  return map[quality] || "";
}

export function romanNumeralForChord(chord, centerPc) {
  const relative = mod12(chord.rootPc - centerPc);
  const degree = degreeDescriptor(relative);
  return `${accidentalPrefix(degree.accidental)}${romanQuality(ROMANS[degree.degreeNumber - 1], chord.templateId || chord.quality)}${extensionSuffix(chord.templateId || chord.quality)}`;
}

export function nashvilleNumberForChord(chord, centerPc) {
  const relative = mod12(chord.rootPc - centerPc);
  const degree = degreeDescriptor(relative);
  const quality = chord.templateId || chord.quality;
  return `${accidentalPrefix(degree.accidental)}${degree.degreeNumber}${QUALITY_SUFFIX[quality] ?? ""}`;
}

export function parseSpelledPitchClass(name) {
  const match = /^([A-Ga-g])([#b]*)$/.exec(String(name).trim());
  if (!match) throw new TypeError(`Unsupported tonic spelling: ${name}`);
  const letter = match[1].toUpperCase();
  let pc = NATURAL_PC[letter];
  for (const accidental of match[2]) pc += accidental === "#" ? 1 : -1;
  return { letter, pitchClass: mod12(pc), accidentalText: match[2] };
}

function signedAccidentalDistance(naturalPc, targetPc) {
  let delta = mod12(targetPc - naturalPc);
  if (delta > 6) delta -= 12;
  return delta;
}

export function spellRelativeDegree(targetTonic, relativeSemitones) {
  const tonic = parseSpelledPitchClass(targetTonic);
  const degree = degreeDescriptor(relativeSemitones);
  const tonicLetterIndex = LETTERS.indexOf(tonic.letter);
  const targetLetter = LETTERS[(tonicLetterIndex + degree.degreeNumber - 1) % 7];
  const targetPc = mod12(tonic.pitchClass + mod12(relativeSemitones));
  const accidental = signedAccidentalDistance(NATURAL_PC[targetLetter], targetPc);
  return `${targetLetter}${accidentalPrefix(accidental)}`;
}

export function chordSymbolInTargetKey(functionCandidate, targetTonic) {
  const root = spellRelativeDegree(targetTonic, functionCandidate.relativeSemitones);
  const quality = functionCandidate.templateId || functionCandidate.quality;
  return `${root}${QUALITY_SUFFIX[quality] ?? ""}`;
}

export function beginnerFunctionDescription(candidate) {
  const roleText = {
    tonic: "home or resting function",
    predominant: "moves away from home and often prepares stronger motion",
    dominant: "strong pull toward a tonal center",
    modal: "modal-color function inside the current pitch system",
    chromatic: "chromatic function outside the current reference system",
    ambiguous: "context-dependent function with no single strong role"
  }[candidate.role || "ambiguous"] || "context-dependent function";
  return `${roleText}; chord root is scale degree ${candidate.degreeLabel || degreeDescriptor(candidate.relativeSemitones).label}`;
}

export function renderFunction(candidate, { format = "roman", targetTonic = null } = {}) {
  if (format === "roman") return candidate.roman;
  if (format === "nashville") return candidate.nashville;
  if (format === "beginner") return beginnerFunctionDescription(candidate);
  if (format === "key") {
    if (!targetTonic) throw new TypeError("targetTonic is required for key rendering");
    return chordSymbolInTargetKey(candidate, targetTonic);
  }
  throw new RangeError(`Unsupported function format: ${format}`);
}
