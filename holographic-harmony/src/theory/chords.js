import { mod12, pitchClassName } from "./pitch.js";
import { normalizePitchClassSet } from "./set-class.js";

export const CHORD_TEMPLATES = Object.freeze([
  { id: "power", name: "power fifth", suffix: "5", intervals: [0, 7] },
  { id: "major", name: "major triad", suffix: "", intervals: [0, 4, 7] },
  { id: "minor", name: "minor triad", suffix: "m", intervals: [0, 3, 7] },
  { id: "diminished", name: "diminished triad", suffix: "dim", intervals: [0, 3, 6] },
  { id: "augmented", name: "augmented triad", suffix: "aug", intervals: [0, 4, 8] },
  { id: "sus2", name: "suspended second", suffix: "sus2", intervals: [0, 2, 7] },
  { id: "sus4", name: "suspended fourth", suffix: "sus4", intervals: [0, 5, 7] },
  { id: "major6", name: "major sixth", suffix: "6", intervals: [0, 4, 7, 9] },
  { id: "minor6", name: "minor sixth", suffix: "m6", intervals: [0, 3, 7, 9] },
  { id: "dominant7", name: "dominant seventh", suffix: "7", intervals: [0, 4, 7, 10] },
  { id: "major7", name: "major seventh", suffix: "maj7", intervals: [0, 4, 7, 11] },
  { id: "minor7", name: "minor seventh", suffix: "m7", intervals: [0, 3, 7, 10] },
  { id: "minorMajor7", name: "minor-major seventh", suffix: "m(maj7)", intervals: [0, 3, 7, 11] },
  { id: "halfDiminished7", name: "half-diminished seventh", suffix: "m7b5", intervals: [0, 3, 6, 10] },
  { id: "diminished7", name: "diminished seventh", suffix: "dim7", intervals: [0, 3, 6, 9] },
  { id: "augmentedMajor7", name: "augmented major seventh", suffix: "aug(maj7)", intervals: [0, 4, 8, 11] },
  { id: "add9", name: "major add nine", suffix: "add9", intervals: [0, 2, 4, 7] },
  { id: "minorAdd9", name: "minor add nine", suffix: "m(add9)", intervals: [0, 2, 3, 7] },
  { id: "dominant9", name: "dominant ninth", suffix: "9", intervals: [0, 2, 4, 7, 10] },
  { id: "major9", name: "major ninth", suffix: "maj9", intervals: [0, 2, 4, 7, 11] },
  { id: "minor9", name: "minor ninth", suffix: "m9", intervals: [0, 2, 3, 7, 10] }
].map((template) => Object.freeze({ ...template, intervals: Object.freeze([...template.intervals]) })));

function templatePitchClasses(rootPc, template) {
  return normalizePitchClassSet(template.intervals.map((interval) => mod12(rootPc + interval)));
}

function setDifference(a, b) {
  const other = new Set(b);
  return [...a].filter((value) => !other.has(value));
}

function intersectionSize(a, b) {
  const other = new Set(b);
  return a.reduce((count, value) => count + (other.has(value) ? 1 : 0), 0);
}

function ratio(numerator, denominator, fallback = 0) {
  return denominator > 0 ? numerator / denominator : fallback;
}

function inversionLabel(rootPc, bassPc, template) {
  if (bassPc == null) return null;
  const bassInterval = mod12(bassPc - rootPc);
  const index = template.intervals.indexOf(bassInterval);
  if (index < 0) return "non-chord bass";
  if (index === 0) return "root position";
  if (template.intervals.length === 3) return index === 1 ? "first inversion" : "second inversion";
  if (template.intervals.length >= 4) {
    return ["root position", "first inversion", "second inversion", "third inversion", "upper extension bass"][Math.min(index, 4)];
  }
  return `chord-tone bass ${index + 1}`;
}

export function chordSymbol(rootPc, templateOrId, { preferFlats = false, bassPc = null } = {}) {
  const template = typeof templateOrId === "string"
    ? CHORD_TEMPLATES.find((item) => item.id === templateOrId)
    : templateOrId;
  if (!template) throw new RangeError(`Unknown chord template: ${templateOrId}`);
  const root = pitchClassName(mod12(rootPc), preferFlats);
  let symbol = `${root}${template.suffix}`;
  if (bassPc != null && mod12(bassPc) !== mod12(rootPc)) symbol += `/${pitchClassName(bassPc, preferFlats)}`;
  return symbol;
}

export function exactChordMatches(pcs, options = {}) {
  const observed = normalizePitchClassSet(pcs);
  const bassPc = options.bassPc == null ? null : mod12(options.bassPc);
  const matches = [];
  for (let rootPc = 0; rootPc < 12; rootPc += 1) {
    for (const template of CHORD_TEMPLATES) {
      const expected = templatePitchClasses(rootPc, template);
      if (expected.length !== observed.length) continue;
      if (!expected.every((pc, index) => pc === observed[index])) continue;
      matches.push(Object.freeze({
        rootPc,
        rootName: pitchClassName(rootPc, options.preferFlats === true),
        templateId: template.id,
        quality: template.id,
        templateName: template.name,
        symbol: chordSymbol(rootPc, template, options),
        pitchClasses: expected,
        intervals: template.intervals,
        bassPc,
        inversion: inversionLabel(rootPc, bassPc, template),
        exact: true,
        support: 1,
        coverage: 1,
        precision: 1,
        jaccard: 1,
        missingPitchClasses: Object.freeze([]),
        extraPitchClasses: Object.freeze([])
      }));
    }
  }
  return Object.freeze(matches);
}

export function rankChordCandidates(pcs, {
  bassPc = null,
  preferFlats = false,
  limit = 12,
  minSupport = 0
} = {}) {
  const observed = normalizePitchClassSet(pcs);
  if (!observed.length) return Object.freeze([]);
  const bass = bassPc == null ? null : mod12(bassPc);
  const candidates = [];

  for (let rootPc = 0; rootPc < 12; rootPc += 1) {
    for (const template of CHORD_TEMPLATES) {
      const expected = templatePitchClasses(rootPc, template);
      const intersection = intersectionSize(observed, expected);
      const unionSize = new Set([...observed, ...expected]).size;
      const coverage = ratio(intersection, expected.length);
      const precision = ratio(intersection, observed.length);
      const jaccard = ratio(intersection, unionSize);
      const rootPresent = observed.includes(rootPc) ? 1 : 0;
      const bassRoot = bass != null && bass === rootPc ? 1 : 0;
      const bassChordTone = bass != null && expected.includes(bass) ? 1 : 0;
      const exact = intersection === observed.length && intersection === expected.length;
      const support = exact ? 1 : Math.min(0.999999,
        0.42 * jaccard +
        0.23 * coverage +
        0.18 * precision +
        0.09 * rootPresent +
        0.05 * bassRoot +
        0.03 * bassChordTone
      );
      if (support < minSupport) continue;
      candidates.push({
        rootPc,
        rootName: pitchClassName(rootPc, preferFlats),
        templateId: template.id,
        quality: template.id,
        templateName: template.name,
        symbol: chordSymbol(rootPc, template, { preferFlats, bassPc: bass }),
        pitchClasses: expected,
        intervals: template.intervals,
        bassPc: bass,
        inversion: inversionLabel(rootPc, bass, template),
        exact,
        support,
        coverage,
        precision,
        jaccard,
        missingPitchClasses: Object.freeze(setDifference(expected, observed)),
        extraPitchClasses: Object.freeze(setDifference(observed, expected))
      });
    }
  }

  candidates.sort((a, b) =>
    Number(b.exact) - Number(a.exact) ||
    b.support - a.support ||
    b.coverage - a.coverage ||
    b.precision - a.precision ||
    a.rootPc - b.rootPc ||
    a.templateId.localeCompare(b.templateId)
  );
  return Object.freeze(candidates.slice(0, Math.max(0, Number(limit) || 0)).map(Object.freeze));
}
