import { validateNoteEventV1 } from "./events.js";
import { complementField, validatePartition } from "../theory/fields.js";
import { describeSetClass } from "../theory/set-class.js";
import { computeAdmissionHistory } from "../theory/admissions.js";
import { extractIntervalSpectrum } from "../fingerprint/blocks/interval-spectrum.js";
import { extractRegisterTexture } from "../fingerprint/blocks/register-texture.js";

export const HARMONIC_STATE_VERSION = "harmonic-state-v1";

export function freezeAnalysis(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeAnalysis);
    Object.freeze(value);
  }
  return value;
}

export function copyAnalysis(value) {
  if (Array.isArray(value)) return value.map(copyAnalysis);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copyAnalysis(child)]));
}

export function validCanonicalEvents(events) {
  return Array.isArray(events) && events.every(event => validateNoteEventV1(event) &&
    event.pitchClass === ((event.midi % 12) + 12) % 12 && event.octave === Math.floor(event.midi / 12) - 1) &&
    new Set(events.map(event => event.id)).size === events.length;
}

export function validPitchSet(value) {
  return Array.isArray(value) && value.every((pc, i) => Number.isInteger(pc) && pc >= 0 && pc < 12 && (!i || value[i - 1] < pc));
}

export function normalizeReferenceField(value) {
  if (!Array.isArray(value) || value.some(pc => !Number.isInteger(pc) || pc < 0 || pc > 11)) throw new TypeError("Reference field requires pitch classes in 0..11");
  return [...new Set(value)].sort((a, b) => a - b);
}

const bins = (value, size) => Array.isArray(value) && value.length === size && value.every(x => Number.isFinite(x) && x >= 0);
export function finiteAnalysisTree(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (!value || typeof value !== "object") return true;
  return Object.values(value).every(finiteAnalysisTree);
}

function clippedEvents(events, start, end) {
  return events.filter(event => event.durationSec === 0
    ? event.onsetSec >= start && event.onsetSec < end
    : event.onsetSec < end && event.endSec > start).map(event => {
    const onsetSec = Math.max(start, event.onsetSec), endSec = Math.min(end, event.endSec);
    return { ...event, onsetSec, endSec, durationSec: Math.max(0, endSec - onsetSec) };
  });
}

function outerVoiceMass(events) {
  const positive = events.filter(event => event.durationSec > 0);
  const boundaries = [...new Set(positive.flatMap(event => [event.onsetSec, event.endSec]))].sort((a, b) => a - b);
  const bass = Array(12).fill(0), top = Array(12).fill(0);
  for (let i = 1; i < boundaries.length; i++) {
    const start = boundaries[i - 1], end = boundaries[i], mid = (start + end) / 2;
    const sounding = positive.filter(event => event.onsetSec <= mid && event.endSec > mid);
    if (!sounding.length) continue;
    let lowest = sounding[0], highest = sounding[0];
    for (const event of sounding) {
      if (event.midi < lowest.midi) lowest = event;
      if (event.midi > highest.midi) highest = event;
    }
    bass[lowest.pitchClass] += end - start;
    top[highest.pitchClass] += end - start;
  }
  return { bass, top };
}

export function admissionHistoryForCanonicalEvents(events, shadowField, time, options = {}) {
  const notes = events.map(event => ({ onset: event.onsetSec, duration: event.durationSec,
    pitchClass: event.pitchClass, tieStart: event.tieStart, tieStop: event.tieStop }))
    .sort((a, b) => a.onset - b.onset);
  return computeAdmissionHistory(notes, shadowField, time, options);
}

export function createHarmonicStateV1(events, {
  id = "window", sourceId, time, windowStart, windowEnd, activeField = null,
  referenceCenterPc = null, inferred = {}, allEvents = events
} = {}) {
  if (referenceCenterPc != null && (!Number.isInteger(referenceCenterPc) || referenceCenterPc < 0 || referenceCenterPc > 11)) throw new TypeError("Reference center requires a pitch class in 0..11");
  if (!validCanonicalEvents(events) || !validCanonicalEvents(allEvents)) throw new TypeError("Consistent unique canonical events required");
  if (typeof sourceId !== "string" || !sourceId) throw new TypeError("sourceId is required");
  if (![time, windowStart, windowEnd].every(Number.isFinite) || windowStart < 0 || windowEnd < windowStart || time < windowStart || time > windowEnd) throw new RangeError("Invalid HarmonicState time window");
  const field = activeField == null ? null : normalizeReferenceField(activeField);
  const shadow = field == null ? null : complementField(field);
  const clipped = clippedEvents(events, windowStart, windowEnd);
  const onsetCounts = Array(12).fill(0), durationWeights = Array(12).fill(0);
  for (const event of clipped) durationWeights[event.pitchClass] += event.durationSec;
  for (const event of events) if (event.onsetSec >= windowStart && event.onsetSec < windowEnd && !event.tieStop) onsetCounts[event.pitchClass]++;
  const interval = extractIntervalSpectrum(clipped), register = extractRegisterTexture(clipped);
  const outer = outerVoiceMass(clipped), mass = durationWeights.reduce((a, b) => a + b, 0);
  const pitchClasses = durationWeights.map((weight, pc) => weight > 0 ? pc : null).filter(pc => pc != null);
  const admissions = shadow == null ? null : admissionHistoryForCanonicalEvents(allEvents, shadow, time);
  return freezeAnalysis({
    schemaVersion: HARMONIC_STATE_VERSION, id: String(id), sourceId, time, windowStart, windowEnd,
    measured: {
      pitchClassActivity: [...durationWeights], activityBasis: "clipped-note-duration-mass",
      onsetCounts, durationWeights, bassPitchClassActivity: outer.bass, topPitchClassActivity: outer.top,
      intervalClassHistogram: interval.distribution.map(value => value * interval.weightedPairDuration),
      intervalClassDistribution: [...interval.distribution], simultaneityCardinality: { ...register.simultaneityCardinality },
      pitchClasses, chromaticDensity: field == null || mass === 0 ? null : durationWeights.reduce((sum, value, pc) => sum + (field.includes(pc) ? 0 : value), 0) / mass,
      register, attackDensity: windowEnd > windowStart ? onsetCounts.reduce((a, b) => a + b, 0) / (windowEnd - windowStart) : 0
    },
    deterministic: { activeField: field, shadowField: shadow, complement: shadow,
      setClass: describeSetClass(pitchClasses), referenceCenterPc },
    inferred: copyAnalysis({ centerCandidates: [], scaleCandidates: [], chordCandidates: [], functionCandidates: [],
      crystallizationCandidates: [], ...inferred }),
    holographic: { admissions: admissions?.ordered ?? [], admissionHistory: admissions,
      shadowActivation: field == null || mass === 0 ? null : durationWeights.reduce((sum, value, pc) => sum + (shadow.includes(pc) ? value : 0), 0) / mass,
      withdrawalRate: null, fieldPersistence: null, centerAmbiguity: null },
    evidenceClasses: { measured: "measured-symbolic-events", deterministic: "deterministic-under-declared-or-inferred-reference",
      inferred: "inferred-analytical; relative weights are not calibrated probabilities",
      holographic: "deterministic-admissions-under-reference-field; persistence-withdrawal-model-pending" }
  });
}

export function validateHarmonicStateV1(value) {
  if (value?.schemaVersion !== HARMONIC_STATE_VERSION || typeof value.id !== "string" || typeof value.sourceId !== "string" || !value.sourceId ||
    ![value.time, value.windowStart, value.windowEnd].every(Number.isFinite) || value.windowStart < 0 || value.windowEnd < value.windowStart || value.time < value.windowStart || value.time > value.windowEnd) return false;
  const measured = value.measured, deterministic = value.deterministic;
  if (!measured || !deterministic || !value.inferred || !value.holographic || !value.evidenceClasses || !finiteAnalysisTree(value)) return false;
  if (!["pitchClassActivity", "onsetCounts", "durationWeights", "bassPitchClassActivity", "topPitchClassActivity"].every(key => bins(measured[key], 12)) || !bins(measured.intervalClassHistogram, 6) || !bins(measured.intervalClassDistribution, 6)) return false;
  if (!validPitchSet(measured.pitchClasses) || !measured.register || !Number.isFinite(measured.attackDensity) || measured.attackDensity < 0 || !measured.simultaneityCardinality || Array.isArray(measured.simultaneityCardinality) || typeof measured.simultaneityCardinality !== "object") return false;
  if (measured.chromaticDensity != null && !(measured.chromaticDensity >= 0 && measured.chromaticDensity <= 1)) return false;
  if (deterministic.referenceCenterPc != null && (!Number.isInteger(deterministic.referenceCenterPc) || deterministic.referenceCenterPc < 0 || deterministic.referenceCenterPc > 11)) return false;
  if (deterministic.activeField == null) {
    if (deterministic.shadowField != null || deterministic.complement != null) return false;
  } else if (!validPitchSet(deterministic.activeField) || !validPitchSet(deterministic.shadowField) ||
    !validatePartition(deterministic.activeField, deterministic.shadowField).valid || JSON.stringify(deterministic.shadowField) !== JSON.stringify(deterministic.complement)) return false;
  return ["centerCandidates", "scaleCandidates", "chordCandidates", "functionCandidates", "crystallizationCandidates"].every(key => Array.isArray(value.inferred[key])) && Array.isArray(value.holographic.admissions);
}
