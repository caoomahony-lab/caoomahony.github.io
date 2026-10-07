import { derivePairwiseDescriptor, comparePairwiseDescriptors } from "./pairwise-distance.js";

// Additive experiment: the HHF-3.9 descriptor and its weights remain unchanged.
export const EVIDENCE_AWARE_VERSION = "pairwise-evidence-audit-v1";
const PROFILE_KEYS = ["motion", "recurrence", "center", "collection", "diversity", "activity"];
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const mod12 = (value) => ((value % 12) + 12) % 12;
const family = (id) => String(id).replace(/major.*/i, "major").replace(/minor.*/i, "minor")
  .replace(/dominant.*/i, "dominant").replace(/halfDiminished.*/i, "diminished");
const hasMass = (histogram) => Object.values(histogram || {}).some((value) => finite(value) && value > 0);
const blend = (parts) => {
  const available = parts.filter(([value]) => finite(value));
  const weight = available.reduce((sum, [, w]) => sum + w, 0);
  return weight ? available.reduce((sum, [value, w]) => sum + value * w, 0) / weight : null;
};
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export function deriveEvidenceAwareDescriptor({ analysis, harmony, fingerprintFeatures, profileAvailability } = {}) {
  const notes = (analysis?.registeredNoteEvents || []).filter((note) =>
    finite(note?.midi) && Number.isInteger(note.midi) && note.midi >= 0 && note.midi <= 127 &&
    finite(note.onset) && note.onset >= 0);
  // Unknown regions stay in place: removing them could invent transitions across gaps.
  const regions = [...(harmony?.regions || [])];
  const timed = regions.every((region) => finite(region?.onset) && region.onset >= 0);
  if (timed) regions.sort((a, b) => a.onset - b.onset);
  const labeled = regions.length > 0 && regions.every((region) =>
    finite(region.rootPc) && Number.isInteger(region.rootPc) && region.rootPc >= 0 && region.rootPc < 12 &&
    typeof region.templateId === "string" && region.templateId.length > 0 && region.templateId !== "unknown");
  const durations = timed && regions.length > 0 && regions.every((region) =>
    (finite(region.duration) && region.duration > 0) || (finite(region.end) && region.end > region.onset));
  const chroma = analysis?.overallChroma;
  const tonal = Array.isArray(chroma) && chroma.length === 12 && chroma.every((v) => finite(v) && v >= 0) &&
    chroma.some((v) => v > 0);
  const profile = PROFILE_KEYS.every((key) => finite(fingerprintFeatures?.[key]) &&
    fingerprintFeatures[key] >= 0 && fingerprintFeatures[key] <= 1 && profileAvailability?.[key] !== false);
  const summary = derivePairwiseDescriptor({ analysis: { ...analysis, registeredNoteEvents: notes }, harmony: { regions }, fingerprintFeatures });
  return freeze({
    version: EVIDENCE_AWARE_VERSION,
    evidenceClass: "inferred-from-audio",
    summary,
    availability: {
      motif: hasMass(summary.material.motifHist),
      interval: hasMass(summary.material.intervalHist),
      rhythm: hasMass(summary.material.rhythmHist),
      harmonic: timed && labeled && hasMass(summary.structure.harmonicTransitionHist),
      recurrence: timed && labeled && regions.length > 1,
      duration: durations,
      tonal,
      profile
    },
    supportedRecurrenceLags: timed && labeled ? Math.min(8, Math.max(0, regions.length - 1)) : 0,
    sequence: timed && labeled ? regions.map((region) => ({ rootPc: region.rootPc, family: family(region.templateId) })) : null,
    counts: { ...summary.counts, rejectedNotes: (analysis?.registeredNoteEvents?.length || 0) - notes.length },
    assumptions: { topLine: "highest registered note within 0.09 seconds; not verified melody", order: "root/chord-family sequence; not functional interpretation" }
  });
}

function editCount(a, b, shift) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const equal = a[i - 1].rootPc === mod12(b[j - 1].rootPc + shift) && a[i - 1].family === b[j - 1].family;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (equal ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

export function orderedHarmonyDistance(a, b, { maxCellUpdates = 3_000_000 } = {}) {
  const counts = { regionsA: a?.length || 0, regionsB: b?.length || 0 };
  if (!a?.length || !b?.length) return freeze({ distance: null, reason: "MISSING_ORDERED_HARMONY", ...counts });
  // Exact transposed copies can be checked in linear time, even for long pieces.
  if (a.length === b.length) {
    for (let shift = 0; shift < 12; shift++) {
      if (a.every((token, i) => token.rootPc === mod12(b[i].rootPc + shift) && token.family === b[i].family)) {
        return freeze({ distance: 0, edits: 0, shiftBToA: shift, reason: null, ...counts });
      }
    }
  }
  if (12 * a.length * b.length > maxCellUpdates) {
    return freeze({ distance: null, reason: "COMPUTE_LIMIT", ...counts });
  }
  let best = Infinity, shiftBToA = 0;
  for (let shift = 0; shift < 12; shift++) {
    const edits = editCount(a, b, shift);
    if (edits < best) { best = edits; shiftBToA = shift; }
  }
  return freeze({ distance: best / Math.max(a.length, b.length), edits: best, shiftBToA, reason: null, ...counts });
}

export function compareEvidenceAwareDescriptors(a, b, { includeOrder = true } = {}) {
  if (a?.version !== EVIDENCE_AWARE_VERSION || b?.version !== EVIDENCE_AWARE_VERSION) {
    return freeze({ version: EVIDENCE_AWARE_VERSION, distance: null, reason: "REANALYSIS_REQUIRED" });
  }
  const original = comparePairwiseDescriptors(a.summary, b.summary);
  const components = Object.fromEntries(Object.entries(original.components).map(([key, value]) =>
    [key, a.availability[key] && b.availability[key] ? value : null]));
  const lags = Math.min(a.supportedRecurrenceLags, b.supportedRecurrenceLags);
  if (components.recurrence != null) {
    components.recurrence = a.summary.structure.recurrence.slice(0, lags).reduce((sum, value, i) =>
      sum + Math.abs(value - b.summary.structure.recurrence[i]), 0) / lags;
  }
  const families = {
    material: blend([[components.motif, .45], [components.interval, .30], [components.rhythm, .25]]),
    structural: blend([[components.harmonic, .50], [components.recurrence, .30], [components.duration, .20]]),
    stylistic: blend([[components.tonal, .50], [components.profile, .50]])
  };
  const available = Object.keys(components).filter((key) => finite(components[key]));
  const distance = blend([[families.material, .45], [families.structural, .35], [families.stylistic, .20]]);
  return freeze({
    version: EVIDENCE_AWARE_VERSION, distance, reason: distance == null ? "NO_SHARED_EVIDENCE" : null,
    families, components,
    similarityIndex: Object.fromEntries(Object.entries(families).map(([key, value]) => [key, value == null ? null : 1 - value])),
    coverage: { available, total: 8, missing: Object.keys(components).filter((key) => !finite(components[key])), recurrenceLags: lags },
    supportSignature: available.map((key) => key === "recurrence" ? `${key}:${lags}` : key).join("|"),
    // No unvalidated weight for sequence distance is inserted into the summary score.
    orderedHarmony: includeOrder ? orderedHarmonyDistance(a.sequence, b.sequence) : null,
    original
  });
}

export function evidenceAwareCorpusPercentile(comparison, descriptors, { minimumPairs = 10 } = {}) {
  if (!finite(comparison?.distance)) return null;
  const valid = (descriptors || []).filter((item) => item?.version === EVIDENCE_AWARE_VERSION);
  const baseline = [];
  for (let i = 0; i < valid.length; i++) for (let j = i + 1; j < valid.length; j++) {
    const result = compareEvidenceAwareDescriptors(valid[i], valid[j], { includeOrder: false });
    if (finite(result.distance) && result.supportSignature === comparison.supportSignature) baseline.push(result.distance);
  }
  if (baseline.length < minimumPairs) return null;
  let greater = 0, equal = 0;
  for (const value of baseline) {
    if (value > comparison.distance + 1e-12) greater++;
    else if (Math.abs(value - comparison.distance) <= 1e-12) equal++;
  }
  return freeze({ percentile: 100 * (greater + .5 * equal) / baseline.length, pairCount: baseline.length, supportSignature: comparison.supportSignature });
}
