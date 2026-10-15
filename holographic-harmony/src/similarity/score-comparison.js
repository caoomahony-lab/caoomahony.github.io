import { validateNoteEventV1 } from "../model/events.js";
import { extractHarmonicFingerprintV1 } from "../fingerprint/extract.js";
import { inferScoreHarmony, SCORE_HARMONY_VERSION } from "../inference/score-harmony.js";
import { CHORD_TEMPLATES } from "../theory/chords.js";
import { assertScoreHIR } from "../model/harmonic-ir.js";
import { orderedHarmonyDistance, orderedHarmonyDistanceAtShift } from "./evidence-aware-distance.js";

export const SCORE_COMPARISON_VERSION = "score-comparison-v1";
export const SCORE_ORDER_CELL_LIMIT = 48_000_000;
export const SCORE_COMPONENTS = Object.freeze([
  { key: "sonorityOrder", label: "Sonority order", evidence: "measured", definition: "Levenshtein edits / longer sequence length. Tokens retain the full pitch-class set and lowest sounding pitch class. One global transposition; rhythm, register and rests are excluded." },
  { key: "pitchContent", label: "Pitch content", evidence: "measured", definition: "Total variation of duration-weighted pitch-class distributions at the displayed global transposition." },
  { key: "bass", label: "Sounding bass", evidence: "measured", definition: "Total variation of duration-weighted lowest-sounding pitch-class distributions at the same transposition." },
  { key: "verticalIntervals", label: "Vertical intervals", evidence: "measured", definition: "Total variation of duration-weighted unordered pitch-class interval-class distributions. Unavailable without simultaneous distinct pitch classes." },
  { key: "upperIntervals", label: "Upper-note intervals", evidence: "measured proxy", definition: "Total variation of signed MIDI intervals between highest attacked notes at exact score attacks. This is not a verified melody or voice-leading assignment." },
  { key: "attackRhythm", label: "Attack rhythm", evidence: "measured", definition: "Total variation of successive inter-attack ratios, rounded to quarter-log2 bins. Uses exact quarter-beat attacks when present, otherwise normalized seconds; uniform tempo scaling is removed." },
  { key: "harmonicRhythm", label: "Sonority durations", evidence: "measured", definition: "Total variation of region-duration / median-duration ratios, rounded to quarter-log2 bins. Uniform tempo scaling is removed; silence is excluded." },
  { key: "candidateOrder", label: "Chord-candidate order", evidence: "inferred", definition: "Normalized edit distance of complete tied best-supported chord-candidate sets, anchored to measured bass. Preserves ambiguity; this is not a functional-harmony verdict." }
].map(Object.freeze));
const mod12 = (value) => ((value % 12) + 12) % 12;
const finite = (value) => typeof value === "number" && Number.isFinite(value);
export const SCORE_DISTRIBUTION_COMPONENTS = Object.freeze(["pitchContent", "bass", "verticalIntervals", "upperIntervals", "attackRhythm", "harmonicRhythm"]);
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
function histogram(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] || 0) + 1;
  const total = values.length;
  return total ? Object.fromEntries(Object.entries(result).map(([key, n]) => [key, n / total])) : null;
}
const ratioBin = (ratio) => String(Math.round(4 * Math.log2(ratio)));
function variation(a, b) {
  if (!a || !b || !Object.values(a).some(v => v > 0) || !Object.values(b).some(v => v > 0)) return null;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return Math.min(1, [...keys].reduce((sum, key) => sum + Math.abs((a[key] || 0) - (b[key] || 0)), 0) / 2);
}
const shifted = (values, shift) => values.map((_, pc) => values[mod12(pc - shift)]);
const token = (region, family) => ({ rootPc: region.bassPc, family });
function distribution(value, required = false) {
  if (value == null) return !required;
  if (typeof value !== "object" || !Object.values(value).every(v => finite(v) && v >= 0)) return false;
  const mass = Object.values(value).reduce((sum, v) => sum + v, 0);
  return Math.abs(mass - 1) < 1e-8 || (!required && mass === 0);
}
export function validateScoreDistributionSummary(value) {
  return value?.version === SCORE_COMPARISON_VERSION && typeof value.sourceId === "string" && value.sourceId.length > 0 &&
    value.distributions != null && ["pitchContent", "bass"].every(key => Array.isArray(value.distributions[key]) && value.distributions[key].length === 12 && distribution(value.distributions[key], true)) &&
    Array.isArray(value.distributions.verticalIntervals) && value.distributions.verticalIntervals.length === 6 &&
    SCORE_DISTRIBUTION_COMPONENTS.every(key => distribution(value.distributions[key]));
}
export function projectScoreDistributionSummary(value) {
  if (!validateScoreComparison(value)) throw new TypeError("Valid score descriptor required for catalog projection");
  return freeze({ version: value.version, sourceId: value.sourceId, distributions: value.distributions });
}
function distributionShift(a, b, rankBy) {
  const key = rankBy === "bass" ? "bass" : "pitchContent";
  let best = Infinity, bestShift = 0;
  for (let shift = 0; shift < 12; shift++) {
    const distance = variation(a.distributions[key], shifted(b.distributions[key], shift));
    if (distance < best - 1e-12) { best = distance; bestShift = shift; }
  }
  return bestShift;
}
function distributionComponents(a, b, shift) {
  return Object.fromEntries(SCORE_DISTRIBUTION_COMPONENTS.map(key => [key, variation(a.distributions[key],
    ["pitchContent", "bass"].includes(key) ? shifted(b.distributions[key], shift) : b.distributions[key])]));
}
export function compareScoreDistributionSummaries(a, b, { rankBy = "pitchContent" } = {}) {
  if (!validateScoreDistributionSummary(a) || !validateScoreDistributionSummary(b)) throw new TypeError("Matching valid distribution summary versions are required");
  if (!SCORE_DISTRIBUTION_COMPONENTS.includes(rankBy)) throw new RangeError("Distribution ranking cannot stand in for order ranking");
  const shiftBToA = distributionShift(a, b, rankBy), components = distributionComponents(a, b, shiftBToA);
  return freeze({ rankBy, distance: components[rankBy], components, shiftBToA, shiftCriterion: rankBy === "bass" ? "bass" : "pitchContent" });
}

export function deriveScoreComparison(events, { sourceId, sourceFormat = null } = {}) {
  return deriveScoreEvidence(events, { sourceId, sourceFormat });
}

export function deriveScoreComparisonFromHIR(hir) {
  assertScoreHIR(hir);
  return deriveScoreEvidence(hir.events, { sourceId: hir.source.id, sourceFormat: hir.source.format }, hir.scoreHarmony);
}

function deriveScoreEvidence(events, { sourceId, sourceFormat = null }, sharedHarmony = null) {
  if (!Array.isArray(events) || !events.length || events.some(event => !validateNoteEventV1(event) || event.pitchClass !== mod12(event.midi))) {
    throw new TypeError("Nonempty, consistent canonical NoteEventV1 score events are required");
  }
  if (typeof sourceId !== "string" || !sourceId.trim()) throw new TypeError("sourceId is required");
  const positive = events.filter(event => event.durationSec > 0);
  if (!positive.length) throw new TypeError("Score contains no sounding note durations");
  const fingerprint = extractHarmonicFingerprintV1(positive, { sourceId, centerPc: 0, centerSource: "absolute-pitch-class-origin-for-rotation; not a tonic estimate" });
  // Request the full candidate universe before selecting the tied cohort.
  // A fixed top-N cutoff can drop different ties when absolute pitch wraps.
  const harmony = sharedHarmony ?? inferScoreHarmony(positive, { candidateLimit: 12 * CHORD_TEMPLATES.length });
  const measuredSequence = harmony.regions.map(region => token(region,
    region.measuredPitchClasses.map(pc => mod12(pc - region.bassPc)).sort((a, b) => a - b).join(",")));
  let ambiguousRegions = 0;
  const candidateSequence = harmony.regions.map(region => {
    const cohort = region.candidates.filter(candidate => Math.abs(candidate.support - region.candidates[0].support) <= 1e-12);
    if (cohort.length > 1) ambiguousRegions++;
    const choices = cohort.map(candidate => `${mod12(candidate.rootPc - region.bassPc)}:${candidate.templateId}`).sort();
    return token(region, choices.join("|"));
  });
  const beats = positive.every(event => finite(event.scoreOnsetQuarterBeat) && event.scoreOnsetQuarterBeat >= 0);
  const duration = fingerprint.durationSec;
  const attacks = positive.map(event => ({ midi: event.midi, time: beats ? event.scoreOnsetQuarterBeat : event.onsetSec / duration }))
    .sort((a, b) => a.time - b.time || b.midi - a.midi);
  const line = [];
  const timeScale = Math.max(1, ...attacks.map(note => note.time));
  for (const note of attacks) {
    const previous = line.at(-1);
    if (!previous || Math.abs(previous.time - note.time) > 1e-10 * timeScale) line.push({ ...note });
    else previous.midi = Math.max(previous.midi, note.midi);
  }
  const intervals = line.slice(1).map((note, i) => String(note.midi - line[i].midi));
  const gaps = line.slice(1).map((note, i) => note.time - line[i].time);
  const regionDurations = harmony.regions.map(region => region.duration);
  const medianDuration = [...regionDurations].sort((a, b) => a - b)[Math.floor(regionDurations.length / 2)];
  return freeze({
    version: SCORE_COMPARISON_VERSION, sourceId,
    provenance: { eventSchemaVersion: events[0].schemaVersion, sourceFormat: sourceFormat || events[0].source,
      scoreHarmonyVersion: SCORE_HARMONY_VERSION, fingerprintAnalysisVersion: fingerprint.analysisVersion,
      attackTimeBasis: beats ? "quarter-beats" : "normalized-seconds" },
    counts: { notes: events.length, soundingNotes: positive.length, attacks: line.length, regions: harmony.regions.length, ambiguousRegions },
    durationSeconds: duration,
    measuredSequence, candidateSequence,
    distributions: {
      pitchContent: fingerprint.normalized.pitchEcology.relativeDurationDistribution,
      bass: fingerprint.normalized.bassGravity.durationWeightedDistribution,
      verticalIntervals: fingerprint.normalized.intervalSpectrum.distribution,
      upperIntervals: histogram(intervals),
      attackRhythm: histogram(gaps.slice(1).map((gap, i) => ratioBin(gap / gaps[i]))),
      harmonicRhythm: histogram(regionDurations.map(value => ratioBin(value / medianDuration)))
    },
    foundationFingerprint: fingerprint,
    limits: "Experimental component distances, not listener-calibrated similarity or probabilities. Pitch/bass are weighted by score seconds. The upper-note proxy is not verified melody. Order excludes rhythm, register and rests; chord candidates remain inferred."
  });
}

export function validateScoreComparison(value) {
  if (value?.version !== SCORE_COMPARISON_VERSION || typeof value.sourceId !== "string" || !value.sourceId ||
      !finite(value.durationSeconds) || value.durationSeconds <= 0 || !value.counts || !value.provenance || !value.distributions) return false;
  const validSequence = sequence => Array.isArray(sequence) && sequence.length > 0 && sequence.every(item =>
    Number.isInteger(item?.rootPc) && item.rootPc >= 0 && item.rootPc < 12 && typeof item.family === "string" && item.family.length > 0);
  return Number.isInteger(value.counts.notes) && value.counts.notes > 0 &&
    value.counts.regions === value.measuredSequence?.length && value.counts.regions === value.candidateSequence?.length &&
    validSequence(value.measuredSequence) && validSequence(value.candidateSequence) && validateScoreDistributionSummary(value);
}

export function compareScoreComparisons(a, b, { rankBy = "sonorityOrder", maxCellUpdates = SCORE_ORDER_CELL_LIMIT } = {}) {
  if (!validateScoreComparison(a) || !validateScoreComparison(b)) throw new TypeError("Matching valid score-comparison versions are required; re-analyze this piece");
  if (!SCORE_COMPONENTS.some(component => component.key === rankBy)) throw new RangeError("Unknown score comparison component");
  if (!Number.isInteger(maxCellUpdates) || maxCellUpdates < 1 || maxCellUpdates > SCORE_ORDER_CELL_LIMIT) throw new RangeError("Invalid score order computation budget");
  const options = { maxCellUpdates };
  let alignment = null;
  if (rankBy === "sonorityOrder" || rankBy === "candidateOrder") {
    const key = rankBy === "sonorityOrder" ? "measuredSequence" : "candidateSequence";
    alignment = orderedHarmonyDistance(a[key], b[key], options);
  }
  let shiftBToA = alignment?.shiftBToA;
  let shiftCriterion = rankBy;
  if (shiftBToA == null) {
    const key = rankBy === "bass" ? "bass" : "pitchContent";
    shiftBToA = distributionShift(a, b, rankBy);
    shiftCriterion = key + (alignment?.reason ? " (order unavailable)" : "");
  }
  const components = distributionComponents(a, b, shiftBToA);
  const order = alignment && rankBy === "sonorityOrder" ? alignment : orderedHarmonyDistanceAtShift(a.measuredSequence, b.measuredSequence, shiftBToA, options);
  const candidateOrder = alignment && rankBy === "candidateOrder" ? alignment : orderedHarmonyDistanceAtShift(a.candidateSequence, b.candidateSequence, shiftBToA, options);
  components.sonorityOrder = order.distance;
  components.candidateOrder = candidateOrder.distance;
  const opening = orderedHarmonyDistance(a.measuredSequence.slice(0, 64), b.measuredSequence.slice(0, 64), options);
  const equal = SCORE_COMPONENTS.filter(component => components[component.key] != null && components[component.key] < 1e-12).map(component => component.label.toLowerCase());
  const explanations = [];
  if (equal.length) explanations.push(`Equal under the displayed alignment for: ${equal.join(", ")}.`);
  if (order.distance > 0) explanations.push(`Sonority order differs: ${order.edits} insertion, deletion or substitution edits across ${order.regionsA}/${order.regionsB} regions. Matching pitch distributions do not imply matching order.`);
  if (order.distance === 0 && (components.attackRhythm > 1e-12 || components.harmonicRhythm > 1e-12)) explanations.push("The sonorities occur in the same order, but their rhythmic proportions differ.");
  if (components.bass > 1e-12) explanations.push("The duration-weighted sounding-bass distribution differs at this transposition.");
  if (order.distance == null) explanations.push("The whole-score order could not be calculated within the declared budget. No whole-score match is inferred from the opening.");
  return freeze({ version: SCORE_COMPARISON_VERSION, sourceA: a.sourceId, sourceB: b.sourceId,
    rankBy, distance: components[rankBy], components, shiftBToA, shiftCriterion,
    order, candidateOrder, opening: { ...opening, selection: "first 64 sounding sonority regions; separate from the whole piece" },
    explanations, unavailable: SCORE_COMPONENTS.filter(component => components[component.key] == null).map(component => component.key),
    overlays: { pitchA: a.distributions.pitchContent, pitchB: shifted(b.distributions.pitchContent, shiftBToA), bassA: a.distributions.bass, bassB: shifted(b.distributions.bass, shiftBToA) },
    note: "All displayed pitch-dependent components use the same global shift selected by the ranking feature. No composite similarity percentage or silent opening fallback is used."
  });
}
