import { mod12 } from "../../theory/pitch.js";
import { normalizeToCenter } from "../../theory/transposition.js";

export const RELATIVE_CHROMATIC_DEGREE_LABELS = Object.freeze([
  "1", "b2", "2", "b3", "3", "4", "#4/b5", "5", "b6", "6", "b7", "7"
]);

function normalizeDistribution(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return Object.freeze(Array(12).fill(0));
  return Object.freeze(values.map((value) => value / total));
}

function normalizedEntropy(distribution) {
  let entropy = 0;
  for (const p of distribution) {
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy / Math.log2(12);
}

function validateWeights(events, weights) {
  if (weights == null) return Array(events.length).fill(1);
  if ((!Array.isArray(weights) && !ArrayBuffer.isView(weights)) || weights.length !== events.length) {
    throw new RangeError("weights must have the same length as events");
  }
  return Array.from(weights, (weight, index) => {
    const numeric = Number(weight);
    if (!Number.isFinite(numeric) || numeric < 0) throw new RangeError(`weights[${index}] must be finite and nonnegative`);
    return numeric;
  });
}

function relativeFieldMask(referenceField, centerPc) {
  if (referenceField == null) return null;
  if (!referenceField || typeof referenceField[Symbol.iterator] !== "function") {
    throw new TypeError("referenceField must be iterable");
  }
  const mask = Array(12).fill(false);
  for (const pc of referenceField) mask[mod12(Number(pc) - centerPc)] = true;
  return mask;
}

export function extractPitchEcology(events, {
  centerPc,
  weights = null,
  referenceField = null,
  topCount = 12
} = {}) {
  if (!Array.isArray(events)) throw new TypeError("events must be an array");
  if (!Number.isFinite(Number(centerPc))) throw new TypeError("centerPc is required");
  const center = mod12(centerPc);
  const eventWeights = validateWeights(events, weights);
  const onsetAbsolute = Array(12).fill(0);
  const durationAbsolute = Array(12).fill(0);

  events.forEach((event, index) => {
    if (!Number.isInteger(event.pitchClass) || event.pitchClass < 0 || event.pitchClass > 11) {
      throw new TypeError(`events[${index}].pitchClass must be an integer in 0..11`);
    }
    const weight = eventWeights[index];
    onsetAbsolute[event.pitchClass] += weight;
    const duration = Number(event.durationSec);
    if (!Number.isFinite(duration) || duration < 0) throw new TypeError(`events[${index}].durationSec must be finite and nonnegative`);
    durationAbsolute[event.pitchClass] += duration * weight;
  });

  const relativeOnsetDistribution = normalizeDistribution([...normalizeToCenter(onsetAbsolute, center)]);
  const relativeDurationDistribution = normalizeDistribution([...normalizeToCenter(durationAbsolute, center)]);
  const count = Math.max(1, Math.min(12, Math.trunc(Number(topCount) || 12)));
  const topDegrees = Object.freeze(Array.from({ length: 12 }, (_, degree) => degree)
    .sort((a, b) => relativeOnsetDistribution[b] - relativeOnsetDistribution[a] || a - b)
    .slice(0, count));
  const mask = relativeFieldMask(referenceField, center);
  const diatonicConcentration = mask == null
    ? null
    : relativeOnsetDistribution.reduce((sum, value, degree) => sum + (mask[degree] ? value : 0), 0);

  return Object.freeze({
    centerPc: center,
    relativeOnsetDistribution,
    relativeDurationDistribution,
    entropy: normalizedEntropy(relativeOnsetDistribution),
    topDegrees,
    tonicShare: relativeOnsetDistribution[0],
    fifthShare: relativeOnsetDistribution[7],
    diatonicConcentration,
    eventCount: events.length,
    labels: RELATIVE_CHROMATIC_DEGREE_LABELS
  });
}
