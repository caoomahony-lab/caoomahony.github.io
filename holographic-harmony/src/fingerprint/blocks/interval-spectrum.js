import { mod12 } from "../../theory/pitch.js";

export const INTERVAL_CLASS_LABELS = Object.freeze([
  "IC1:m2/M7", "IC2:M2/m7", "IC3:m3/M6", "IC4:M3/m6", "IC5:P4/P5", "IC6:tritone"
]);

function normalize(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  return total > 0 ? Object.freeze(values.map((value) => value / total)) : Object.freeze(values.map(() => 0));
}

function ic(a, b) {
  const distance = mod12(b - a);
  return Math.min(distance, 12 - distance);
}

function segmentHistogram(pitchClasses) {
  const pcs = [...new Set(pitchClasses)].sort((a, b) => a - b);
  const counts = Array(6).fill(0);
  for (let i = 0; i < pcs.length; i += 1) {
    for (let j = i + 1; j < pcs.length; j += 1) {
      const intervalClass = ic(pcs[i], pcs[j]);
      if (intervalClass >= 1 && intervalClass <= 6) counts[intervalClass - 1] += 1;
    }
  }
  return counts;
}

function validateEvents(events) {
  events.forEach((event, index) => {
    if (!Number.isFinite(event.onsetSec) || !Number.isFinite(event.endSec) || event.endSec < event.onsetSec) {
      throw new TypeError(`events[${index}] must have valid onsetSec/endSec`);
    }
    if (!Number.isInteger(event.pitchClass) || event.pitchClass < 0 || event.pitchClass > 11) {
      throw new TypeError(`events[${index}].pitchClass must be an integer in 0..11`);
    }
  });
}

export function extractIntervalSpectrum(events, { rangeStartSec = null, rangeEndSec = null } = {}) {
  if (!Array.isArray(events)) throw new TypeError("events must be an array");
  validateEvents(events);
  const positive = events.filter((event) => event.endSec > event.onsetSec);
  if (!positive.length) {
    return Object.freeze({
      distribution: Object.freeze(Array(6).fill(0)),
      localVariance: 0,
      localVarianceByClass: Object.freeze(Array(6).fill(0)),
      dissonanceConcentration: 0,
      fourthFifthShare: 0,
      thirdsSixthsShare: 0,
      tritoneShare: 0,
      weightedPairDuration: 0,
      segmentCount: 0,
      labels: INTERVAL_CLASS_LABELS
    });
  }

  const naturalStart = Math.min(...positive.map((event) => event.onsetSec));
  const naturalEnd = Math.max(...positive.map((event) => event.endSec));
  const startLimit = rangeStartSec == null ? naturalStart : Number(rangeStartSec);
  const endLimit = rangeEndSec == null ? naturalEnd : Number(rangeEndSec);
  if (!Number.isFinite(startLimit) || !Number.isFinite(endLimit) || endLimit < startLimit) {
    throw new RangeError("invalid interval-spectrum time range");
  }

  const boundaries = new Set([startLimit, endLimit]);
  for (const event of positive) {
    if (event.endSec <= startLimit || event.onsetSec >= endLimit) continue;
    boundaries.add(Math.max(startLimit, event.onsetSec));
    boundaries.add(Math.min(endLimit, event.endSec));
  }
  const times = [...boundaries].sort((a, b) => a - b);
  const weighted = Array(6).fill(0);
  const local = [];
  let weightedPairDuration = 0;

  for (let i = 0; i < times.length - 1; i += 1) {
    const start = times[i];
    const end = times[i + 1];
    if (!(end > start)) continue;
    const mid = (start + end) / 2;
    const pcs = positive
      .filter((event) => event.onsetSec <= mid && event.endSec > mid)
      .map((event) => event.pitchClass);
    const counts = segmentHistogram(pcs);
    const pairCount = counts.reduce((sum, value) => sum + value, 0);
    if (!pairCount) continue;
    const duration = end - start;
    for (let k = 0; k < 6; k += 1) weighted[k] += counts[k] * duration;
    weightedPairDuration += pairCount * duration;
    local.push(normalize(counts));
  }

  const distribution = normalize(weighted);
  const localVarianceByClass = Array(6).fill(0);
  if (local.length) {
    for (let k = 0; k < 6; k += 1) {
      const mean = local.reduce((sum, row) => sum + row[k], 0) / local.length;
      localVarianceByClass[k] = local.reduce((sum, row) => sum + ((row[k] - mean) ** 2), 0) / local.length;
    }
  }
  const localVariance = localVarianceByClass.reduce((sum, value) => sum + value, 0) / 6;

  return Object.freeze({
    distribution,
    localVariance,
    localVarianceByClass: Object.freeze(localVarianceByClass),
    dissonanceConcentration: distribution[0] + distribution[1] + distribution[5],
    fourthFifthShare: distribution[4],
    thirdsSixthsShare: distribution[2] + distribution[3],
    tritoneShare: distribution[5],
    weightedPairDuration,
    segmentCount: local.length,
    labels: INTERVAL_CLASS_LABELS
  });
}
