import { validCanonicalEvents, normalizeReferenceField, validPitchSet, freezeAnalysis, copyAnalysis,
  createHarmonicStateV1, validateHarmonicStateV1, finiteAnalysisTree, admissionHistoryForCanonicalEvents } from "./harmonic-state.js";
import { inferScoreHarmony, SCORE_HARMONY_VERSION } from "../inference/score-harmony.js";
import { inferCenterCandidates } from "../inference/centers.js";
import { inferScaleCandidatesForCenter } from "../inference/scales.js";
import { analyzeHarmonicObjectSequence } from "../analysis/harmonic-objects.js";
import { CHORD_TEMPLATES } from "../theory/chords.js";
import { degreeDescriptor } from "../theory/functions.js";
import { mod12 } from "../theory/pitch.js";
import { complementField } from "../theory/fields.js";
import { transposeEvents, transposePitchSet } from "../theory/transposition.js";

export const HARMONIC_IR_VERSION = "hir-1";
export const HARMONIC_IR_ANALYSIS_VERSION = "hir-analysis-v1";
export const HIR_LIMITS = Object.freeze({ noteEvents: 20000, harmonicWindows: 10000 });
const knownHIR = new WeakSet();

function stableRanking(a, b, anchor, key) {
  const delta = b.support - a.support;
  return Math.abs(delta) > 1e-12 ? delta : mod12(a[key] - anchor) - mod12(b[key] - anchor) || String(a.systemId || "").localeCompare(String(b.systemId || ""));
}

function sourceMetadata(sourceId, sourceFormat, events, parserVersion) {
  if (typeof sourceId !== "string" || !sourceId.trim()) throw new TypeError("HIR sourceId is required");
  const format = sourceFormat || events[0]?.source;
  if (!["musicxml", "mxl", "midi", "manual"].includes(format)) throw new TypeError("Unsupported HIR source format");
  if (sourceId.startsWith("sha256:") && !/^sha256:[a-f0-9]{64}$/.test(sourceId)) throw new TypeError("Invalid HIR source SHA-256");
  return { id: sourceId, format, sha256: sourceId.startsWith("sha256:") ? sourceId.slice(7) : null,
    parserVersion: parserVersion || "unversioned-parser; note-event-adapter-v1" };
}

function absoluteFunction(candidate, center) {
  return { ...candidate, relativeRootPc: candidate.rootPc, relativeCenterPc: candidate.centerPc,
    rootPc: mod12(candidate.rootPc + center), centerPc: mod12(candidate.centerPc + center),
    chordSymbolRelativeToReference: candidate.chordSymbol, chordSymbol: null };
}

export function buildScoreHIR(events, {
  sourceId, sourceFormat = null, parserVersion = null, referenceCenterPc = null, referenceField = null,
  transformations = []
} = {}) {
  if (!validCanonicalEvents(events) || !events.length || !events.some(event => event.durationSec > 0)) throw new TypeError("Nonempty consistent canonical score events with sounding durations required for HIR");
  if (events.length > HIR_LIMITS.noteEvents) throw new RangeError("HIR note-event limit exceeded; legacy comparisons remain available");
  if (referenceCenterPc != null && (!Number.isInteger(referenceCenterPc) || referenceCenterPc < 0 || referenceCenterPc > 11)) throw new TypeError("Reference center requires a pitch class in 0..11");
  if (!Array.isArray(transformations) || !finiteAnalysisTree(transformations)) throw new TypeError("Invalid transformation history");
  const retained = copyAnalysis(events), positive = retained.filter(event => event.durationSec > 0);
  const durationSec = Math.max(...retained.map(event => event.endSec));
  const source = sourceMetadata(sourceId, sourceFormat, retained, parserVersion);
  const requestedField = referenceField == null ? null : normalizeReferenceField(referenceField);
  const seed = createHarmonicStateV1(retained, { sourceId, id: "global", time: 0, windowStart: 0, windowEnd: durationSec });
  const anchor = [...positive].sort((a, b) => a.onsetSec - b.onsetSec || a.midi - b.midi || a.sourceOrdinal - b.sourceOrdinal)[0].pitchClass;
  const candidateCenters = [...inferCenterCandidates(seed.measured.durationWeights, {
    bassActivity: seed.measured.bassPitchClassActivity, limit: 12, scaleLimitPerCenter: 8
  })].sort((a, b) => stableRanking(a, b, anchor, "centerPc"));
  const center = referenceCenterPc ?? candidateCenters[0].centerPc;
  const ties = candidateCenters.filter(candidate => Math.abs(candidate.support - candidateCenters[0].support) <= 1e-12).map(candidate => candidate.centerPc);
  const scaleCandidates = [...inferScaleCandidatesForCenter(seed.measured.durationWeights, center, { limit: 8 })]
    .sort((a, b) => stableRanking(a, b, center, "rootPc"));
  const field = requestedField ?? [...scaleCandidates[0].pcs];
  const selectedReferenceCenter = { pc: center, source: referenceCenterPc == null ? "inferred-normalization-anchor" : "declared-reference",
    ambiguous: referenceCenterPc == null && ties.length > 1, tiedBestCandidates: referenceCenterPc == null ? ties : [],
    anchorPc: anchor, note: "A normalization reference, not a verified key; all center hypotheses remain available." };
  const rawHarmony = inferScoreHarmony(positive, { candidateLimit: 12 * CHORD_TEMPLATES.length, includeHarmonicAnalysis: false });
  if (rawHarmony.regions.length > HIR_LIMITS.harmonicWindows) throw new RangeError("HIR harmonic-window limit exceeded; legacy comparisons remain available");
  // Keep the full best-supported cohort, even when it exceeds the display limit.
  const regions = rawHarmony.regions.map(region => ({ ...region, candidates: region.candidates.filter((candidate, index) =>
    index < 6 || Math.abs(candidate.support - region.candidates[0].support) <= 1e-12) }));
  const relativeSequence = regions.map(region => ({ pcs: region.measuredPitchClasses.map(pc => mod12(pc - center)).sort((a, b) => a - b),
    bassPc: mod12(region.bassPc - center), weight: region.duration }));
  const harmonicObjects = analyzeHarmonicObjectSequence(relativeSequence);
  const contextual = harmonicObjects.contextualFunction;
  const functionalCandidates = contextual.chords.map(entry => ({ index: entry.index,
    candidates: entry.candidates.map(candidate => absoluteFunction(candidate, center)) }));
  const centerSummary = candidateCenters.map(({ centerPc, support, relativeWeight }) => ({ centerPc, support, relativeWeight, scope: "whole-score" }));
  const scaleSummary = scaleCandidates.map(({ rootPc, systemId, support, relativeWeight }) => ({ rootPc, systemId, support, relativeWeight, scope: "whole-score-reference" }));
  const makeInferred = region => ({ centerCandidates: centerSummary, scaleCandidates: scaleSummary,
    chordCandidates: region?.candidates ?? [], functionCandidates: region ? functionalCandidates[region.index].candidates : [],
    crystallizationCandidates: [], hypothesisScope: "whole-score contextual sequence; not a local center-trajectory estimator" });
  const harmonicWindows = regions.map(region => {
    const indices = retained.map((event, index) => (event.durationSec === 0
      ? event.onsetSec >= region.onset && event.onsetSec < region.end
      : event.onsetSec < region.end && event.endSec > region.onset) ? index : null).filter(index => index != null);
    return { index: region.index, eventIndices: indices, state: createHarmonicStateV1(indices.map(index => retained[index]), {
      sourceId, id: `sonority:${region.index}`, time: (region.onset + region.end) / 2, windowStart: region.onset, windowEnd: region.end,
      activeField: field, referenceCenterPc: center, inferred: makeInferred(region), allEvents: retained
    }) };
  });
  const result = freezeAnalysis({
    schemaVersion: HARMONIC_IR_VERSION, analysisVersion: HARMONIC_IR_ANALYSIS_VERSION,
    source, events: retained, durationSec, candidateCenters, selectedReferenceCenter, referenceField: field,
    relativeEvents: retained.map(event => ({ eventId: event.id, absolutePitchClass: event.pitchClass,
      relativePitchClass: mod12(event.pitchClass - center), degree: { ...degreeDescriptor(mod12(event.pitchClass - center)) } })),
    globalState: createHarmonicStateV1(retained, { sourceId, id: "global", time: 0, windowStart: 0, windowEnd: durationSec,
      activeField: field, referenceCenterPc: center, inferred: makeInferred(null), allEvents: retained }),
    harmonicWindows, functionalCandidates, harmonicObjects,
    scoreHarmony: { version: SCORE_HARMONY_VERSION, regionCount: regions.length, regions },
    provenance: { eventSchemaVersion: retained[0].schemaVersion, hirSchemaVersion: HARMONIC_IR_VERSION,
      analysisVersion: HARMONIC_IR_ANALYSIS_VERSION, scoreHarmonyVersion: SCORE_HARMONY_VERSION,
      configuration: { referenceCenterPc, referenceField: requestedField, centerPolicy: "whole-score-duration-and-bass; ties-relative-to-first-lowest-attack",
        windowPolicy: "sounding-sonority-onset-offset; rests-retained-as-gaps", limits: { ...HIR_LIMITS } },
      transformations: copyAnalysis(transformations), evidence: "Symbolic measurements and exact field arithmetic remain separate from inferred centers/chords/functions.",
      pending: ["voice-leading fingerprint", "temporal architecture", "recurrence", "full Holographic fingerprint", "local center trajectory"] }
  });
  knownHIR.add(result);
  return result;
}

export function validateScoreHIR(value) {
  if (value?.schemaVersion !== HARMONIC_IR_VERSION || value.analysisVersion !== HARMONIC_IR_ANALYSIS_VERSION ||
    !value.source || typeof value.source.id !== "string" || !value.source.id || !validCanonicalEvents(value.events) || !value.events.length ||
    value.events.length > HIR_LIMITS.noteEvents || !Number.isFinite(value.durationSec) || value.durationSec <= 0 || !finiteAnalysisTree(value)) return false;
  if (!["musicxml", "mxl", "midi", "manual"].includes(value.source.format) || typeof value.source.parserVersion !== "string") return false;
  if (value.source.id.startsWith("sha256:") && (!/^sha256:[a-f0-9]{64}$/.test(value.source.id) || value.source.sha256 !== value.source.id.slice(7))) return false;
  const center = value.selectedReferenceCenter?.pc;
  if (!Number.isInteger(center) || center < 0 || center > 11 || !validPitchSet(value.referenceField) || !Array.isArray(value.candidateCenters) || !value.candidateCenters.length) return false;
  if (Math.abs(value.durationSec - Math.max(...value.events.map(event => event.endSec))) > 1e-9 || !value.events.some(event => event.durationSec > 0)) return false;
  if (!Array.isArray(value.relativeEvents) || value.relativeEvents.length !== value.events.length || value.relativeEvents.some((entry, i) =>
    entry.eventId !== value.events[i].id || entry.absolutePitchClass !== value.events[i].pitchClass || entry.relativePitchClass !== mod12(value.events[i].pitchClass - center) || entry.degree?.semitones !== entry.relativePitchClass)) return false;
  if (!validateHarmonicStateV1(value.globalState) || value.globalState.sourceId !== value.source.id || value.globalState.windowStart !== 0 || value.globalState.windowEnd !== value.durationSec || value.globalState.deterministic.referenceCenterPc !== center || JSON.stringify(value.globalState.deterministic.activeField) !== JSON.stringify(value.referenceField)) return false;
  const windows = value.harmonicWindows, regions = value.scoreHarmony?.regions;
  if (!Array.isArray(windows) || !windows.length || windows.length > HIR_LIMITS.harmonicWindows || !Array.isArray(regions) || windows.length !== regions.length || value.scoreHarmony.regionCount !== windows.length || value.scoreHarmony.version !== SCORE_HARMONY_VERSION) return false;
  if (!Array.isArray(value.functionalCandidates) || value.functionalCandidates.length !== windows.length || !value.harmonicObjects?.contextualFunction || !value.provenance?.configuration || !Array.isArray(value.provenance.transformations)) return false;
  return windows.every((window, i) => window.index === i && validateHarmonicStateV1(window.state) && window.state.sourceId === value.source.id &&
    window.state.windowStart === regions[i].onset && window.state.windowEnd === regions[i].end && regions[i].index === i &&
    (!i || window.state.windowStart >= windows[i - 1].state.windowEnd) &&
    JSON.stringify(window.state.deterministic.activeField) === JSON.stringify(value.referenceField) &&
    window.state.deterministic.referenceCenterPc === center &&
    Array.isArray(window.eventIndices) && window.eventIndices.every(index => Number.isInteger(index) && index >= 0 && index < value.events.length) &&
    validPitchSet(regions[i].measuredPitchClasses) && Array.isArray(regions[i].candidates) && regions[i].candidates.length > 0);
}

export function assertScoreHIR(value) {
  if (!knownHIR.has(value)) {
    if (!validateScoreHIR(value)) throw new TypeError("Invalid or incompatible HIR; re-analyze the source");
    freezeAnalysis(value);
    knownHIR.add(value);
  }
  return value;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}

export function serializeScoreHIR(value, { pretty = true } = {}) {
  if (!validateScoreHIR(value)) throw new TypeError("Invalid HIR for export");
  return JSON.stringify(canonical(value), null, pretty ? 2 : 0);
}

// Math.exp and other derived calculations can differ by a few ulps across JS engines.
// Source records, provenance, keys and integer values still require exact agreement.
function agreesWithRebuild(value, rebuilt, allowRounding = true) {
  if (value === rebuilt) return true;
  if (typeof value === "number" && typeof rebuilt === "number") {
    return allowRounding && !Number.isInteger(value) && !Number.isInteger(rebuilt) &&
      Math.abs(value - rebuilt) <= 64 * Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(rebuilt));
  }
  if (!value || !rebuilt || typeof value !== "object" || typeof rebuilt !== "object" || Array.isArray(value) !== Array.isArray(rebuilt)) return false;
  const keys = Object.keys(value), rebuiltKeys = Object.keys(rebuilt).filter(key => rebuilt[key] !== undefined);
  return keys.length === rebuiltKeys.length && keys.every(key => Object.hasOwn(rebuilt, key) && rebuilt[key] !== undefined &&
    agreesWithRebuild(value[key], rebuilt[key], allowRounding));
}

export function parseScoreHIR(text) {
  const value = JSON.parse(String(text));
  if (!validateScoreHIR(value)) throw new TypeError("Invalid or unsupported HIR JSON");
  const rebuilt = buildScoreHIR(value.events, { sourceId: value.source.id, sourceFormat: value.source.format,
    parserVersion: value.source.parserVersion, ...value.provenance.configuration, transformations: value.provenance.transformations });
  if (Object.keys(value).length !== Object.keys(rebuilt).length || Object.keys(value).some(key => !Object.hasOwn(rebuilt, key) ||
    !agreesWithRebuild(value[key], rebuilt[key], !["source", "events", "provenance"].includes(key)))) {
    throw new TypeError("HIR derived records do not agree with source events and configuration");
  }
  return rebuilt;
}

export function transposeScoreHIR(value, semitones, { spellingPolicy = "derived", preferFlats = false } = {}) {
  assertScoreHIR(value);
  if (!Number.isInteger(semitones)) throw new TypeError("Transposition requires integer semitones");
  return buildScoreHIR(transposeEvents(value.events, semitones, { spellingPolicy, preferFlats }), {
    sourceId: value.source.id, sourceFormat: value.source.format, parserVersion: value.source.parserVersion,
    referenceCenterPc: mod12(value.selectedReferenceCenter.pc + semitones), referenceField: [...transposePitchSet(value.referenceField, semitones)],
    transformations: [...value.provenance.transformations, { engineVersion: "transpose-events-v1", semitones, spellingPolicy, preferFlats,
      fromCenterPc: value.selectedReferenceCenter.pc, toCenterPc: mod12(value.selectedReferenceCenter.pc + semitones),
      note: "Derived view; original spelling is retained as sourceSpelling. Target-key notation policy is not inferred." }]
  });
}

export function harmonicStateAt(value, time, context = {}) {
  assertScoreHIR(value);
  if (!Number.isFinite(time) || time < 0) throw new RangeError("HarmonicState time must be finite and nonnegative");
  const windows = value.harmonicWindows;
  let lo = 0, hi = windows.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (windows[mid].state.windowStart <= time) lo = mid + 1; else hi = mid; }
  const candidate = windows[lo - 1]?.state;
  const state = candidate && time < candidate.windowEnd ? candidate : createHarmonicStateV1([], {
    sourceId: value.source.id, id: "silence", time, windowStart: time, windowEnd: time,
    activeField: value.referenceField, referenceCenterPc: value.selectedReferenceCenter.pc
  });
  const field = context.activeField == null ? value.referenceField : normalizeReferenceField(context.activeField);
  const shadow = complementField(field);
  const activity = context.activity?.raw ?? state.measured.pitchClassActivity;
  if (!Array.isArray(activity) || activity.length !== 12 || activity.some(x => !Number.isFinite(x) || x < 0)) throw new TypeError("Invalid live pitch activity");
  const history = context.admissionHistory ?? admissionHistoryForCanonicalEvents(value.events, shadow, time);
  if (history && history.ordered.some(entry => !shadow.includes(entry.pc))) throw new TypeError("Live admissions do not belong to the supplied shadow field");
  const mass = activity.reduce((a, b) => a + b, 0);
  return freezeAnalysis({ ...state, time, windowStart: Math.min(state.windowStart, time), windowEnd: Math.max(state.windowEnd, time),
    measured: { ...state.measured, pitchClassActivity: [...activity], activityBasis: context.activity ? "live-decayed-note-kernel" : state.measured.activityBasis,
      chromaticDensity: state.measured.durationWeights.reduce((a, b) => a + b, 0) > 0
        ? state.measured.durationWeights.reduce((sum, x, pc) => sum + (shadow.includes(pc) ? x : 0), 0) / state.measured.durationWeights.reduce((a, b) => a + b, 0) : null },
    deterministic: { ...state.deterministic, activeField: field, shadowField: shadow, complement: shadow },
    inferred: { ...state.inferred, scaleCandidates: copyAnalysis(context.scaleCandidates ?? state.inferred.scaleCandidates),
      crystallizationCandidates: context.crystallization == null ? [] : [copyAnalysis(context.crystallization)] },
    holographic: { ...state.holographic, admissions: copyAnalysis(history?.ordered ?? []), admissionHistory: copyAnalysis(history),
      shadowActivation: mass ? activity.reduce((sum, x, pc) => sum + (shadow.includes(pc) ? x : 0), 0) / mass : null }
  });
}
