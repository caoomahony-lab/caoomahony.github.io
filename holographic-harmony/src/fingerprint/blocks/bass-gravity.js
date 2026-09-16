import { mod12 } from "../../theory/pitch.js";
import { normalizeToCenter } from "../../theory/transposition.js";

function normalize(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  return total > 0 ? Object.freeze(values.map((value) => value / total)) : Object.freeze(Array(values.length).fill(0));
}

function intervalClass(a, b) {
  const distance = mod12(b - a);
  return Math.min(distance, 12 - distance);
}

function relativeFieldMask(referenceField, centerPc) {
  if (referenceField == null) return null;
  const mask = Array(12).fill(false);
  for (const pc of referenceField) mask[mod12(Number(pc) - centerPc)] = true;
  return mask;
}

function validateEvent(event, index) {
  if (!Number.isFinite(event.onsetSec) || !Number.isFinite(event.endSec) || event.endSec < event.onsetSec) {
    throw new TypeError(`events[${index}] must have valid onsetSec/endSec`);
  }
  if (!Number.isInteger(event.midi) || event.midi < 0 || event.midi > 127) {
    throw new TypeError(`events[${index}].midi must be an integer in 0..127`);
  }
}

function buildBassTimeline(events) {
  const positive = events.filter((event) => event.endSec > event.onsetSec);
  const boundaries = [...new Set(positive.flatMap((event) => [event.onsetSec, event.endSec]))].sort((a, b) => a - b);
  const segments = [];

  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    if (!(end > start)) continue;
    const mid = (start + end) / 2;
    let bass = null;
    for (const event of positive) {
      if (event.onsetSec <= mid && event.endSec > mid && (!bass || event.midi < bass.midi)) bass = event;
    }
    if (!bass) continue;
    const previous = segments[segments.length - 1];
    if (previous && previous.pitchClass === bass.pitchClass && Math.abs(previous.end - start) < 1e-9) {
      previous.end = end;
      previous.duration += end - start;
    } else {
      segments.push({ start, end, duration: end - start, midi: bass.midi, pitchClass: bass.pitchClass });
    }
  }
  return segments;
}

function bassAtOnset(events, time) {
  let bass = null;
  for (const event of events) {
    const active = event.onsetSec <= time + 1e-9 && event.endSec > time + 1e-9;
    const startsHere = Math.abs(event.onsetSec - time) < 1e-9;
    if ((active || startsHere) && (!bass || event.midi < bass.midi)) bass = event;
  }
  return bass;
}

export function extractBassGravity(events, { centerPc, referenceField = null } = {}) {
  if (!Array.isArray(events)) throw new TypeError("events must be an array");
  if (!Number.isFinite(Number(centerPc))) throw new TypeError("centerPc is required");
  events.forEach(validateEvent);
  const center = mod12(centerPc);
  const durationAbsolute = Array(12).fill(0);
  const onsetAbsolute = Array(12).fill(0);
  const segments = buildBassTimeline(events);

  for (const segment of segments) durationAbsolute[segment.pitchClass] += segment.duration;

  const onsetTimes = [...new Set(events.map((event) => event.onsetSec))].sort((a, b) => a - b);
  for (const time of onsetTimes) {
    const bass = bassAtOnset(events, time);
    if (bass) onsetAbsolute[bass.pitchClass] += 1;
  }

  const durationWeightedDistribution = normalize([...normalizeToCenter(durationAbsolute, center)]);
  const onsetWeightedDistribution = normalize([...normalizeToCenter(onsetAbsolute, center)]);
  const transitionCounts = Array(7).fill(0);
  let repeats = 0;
  let fourthFifth = 0;
  let steps = 0;
  const transitions = Math.max(0, segments.length - 1);

  for (let i = 1; i < segments.length; i += 1) {
    const ic = intervalClass(segments[i - 1].pitchClass, segments[i].pitchClass);
    transitionCounts[ic] += 1;
    if (ic === 0) repeats += 1;
    if (ic === 5) fourthFifth += 1;
    if (ic === 1 || ic === 2) steps += 1;
  }

  const soundingDurationSec = segments.reduce((sum, segment) => sum + segment.duration, 0);
  const dominantBassDegree = durationWeightedDistribution.reduce((best, value, degree, values) => value > values[best] ? degree : best, 0);
  const mask = relativeFieldMask(referenceField, center);
  const chromaticBassRate = mask == null
    ? null
    : durationWeightedDistribution.reduce((sum, value, degree) => sum + (mask[degree] ? 0 : value), 0);
  const longestRun = segments.reduce((max, segment) => Math.max(max, segment.duration), 0);

  return Object.freeze({
    centerPc: center,
    durationWeightedDistribution,
    onsetWeightedDistribution,
    bassRepetitionProbability: transitions ? repeats / transitions : 0,
    intervalClassTransitionHistogram: normalize(transitionCounts),
    fourthFifthMotionRate: transitions ? fourthFifth / transitions : 0,
    stepwiseBassRate: transitions ? steps / transitions : 0,
    chromaticBassRate,
    pedalPersistence: soundingDurationSec > 0 ? longestRun / soundingDurationSec : 0,
    dominantBassDegree,
    dominantBassShare: durationWeightedDistribution[dominantBassDegree],
    soundingDurationSec,
    stateCount: segments.length
  });
}
