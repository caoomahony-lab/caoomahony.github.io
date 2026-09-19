export const LOCAL_TIMING_ALIGNMENT_VERSION = "local-timing-alignment-v1";

const EPSILON = 1e-9;

function mod12(value) {
  return ((Number(value) % 12) + 12) % 12;
}

function pitchClasses(region) {
  return [...new Set(
    (region?.observedPitchClasses || region?.measuredPitchClasses || region?.pcs || []).map(mod12)
  )].sort((a, b) => a - b);
}

function jaccard(leftRaw, rightRaw) {
  const left = new Set(leftRaw);
  const right = new Set(rightRaw);
  const union = new Set([...left, ...right]);
  if (!union.size) return 0;
  let intersection = 0;
  for (const pc of left) if (right.has(pc)) intersection += 1;
  return intersection / union.size;
}

function validateRegions(regionsRaw, name) {
  if (!Array.isArray(regionsRaw) || !regionsRaw.length) {
    throw new TypeError(name + " must be a nonempty array");
  }
  return regionsRaw.map((region, index) => {
    const onset = Number(region?.onset);
    const end = Number(region?.end);
    if (!Number.isFinite(onset) || !Number.isFinite(end) || end <= onset) {
      throw new TypeError(name + "[" + index + "] must provide finite onset < end");
    }
    return region;
  });
}

function windowEvidence(audioRegions, scoreRegions, offset, windowStart, windowEnd) {
  let overlap = 0;
  let agreementSum = 0;

  for (const audio of audioRegions) {
    const audioStart = Math.max(Number(audio.onset), windowStart);
    const audioEnd = Math.min(Number(audio.end), windowEnd);
    if (audioEnd <= audioStart + EPSILON) continue;

    for (const score of scoreRegions) {
      const shiftedStart = Number(score.onset) + offset;
      const shiftedEnd = Number(score.end) + offset;
      const seconds = Math.max(
        0,
        Math.min(audioEnd, shiftedEnd) - Math.max(audioStart, shiftedStart)
      );
      if (seconds <= EPSILON) continue;

      const pitchAgreement = jaccard(pitchClasses(audio), pitchClasses(score));
      const audioRoot = audio.rootPc == null ? null : mod12(audio.rootPc);
      const scoreRoot = score.rootPc == null ? null : mod12(score.rootPc);
      const rootAgreement = audioRoot == null || scoreRoot == null
        ? pitchAgreement
        : Number(audioRoot === scoreRoot);

      agreementSum += seconds * (0.72 * pitchAgreement + 0.28 * rootAgreement);
      overlap += seconds;
    }
  }

  const duration = Math.max(EPSILON, windowEnd - windowStart);
  const coverage = Math.min(1, overlap / duration);
  const agreement = overlap > EPSILON ? agreementSum / overlap : 0;
  return Object.freeze({
    offset,
    overlap,
    coverage,
    agreement,
    objective: agreement * coverage
  });
}

function offsetGrid(center, radius, step) {
  const count = Math.max(0, Math.ceil((radius * 2) / step));
  const values = [];
  for (let index = 0; index <= count; index += 1) {
    const value = Math.min(center + radius, center - radius + index * step);
    if (!values.length || Math.abs(value - values.at(-1)) > EPSILON) values.push(value);
  }
  return values;
}

export function estimateConstrainedLocalAlignment(audioRegionsRaw, scoreRegionsRaw, options = {}) {
  const audioRegions = validateRegions(audioRegionsRaw, "audioRegions");
  const scoreRegions = validateRegions(scoreRegionsRaw, "scoreRegions");

  const globalOffset = Number(options.globalOffsetSeconds ?? 0);
  const windowSeconds = Math.max(2, Number(options.windowSeconds ?? 8));
  const searchRadiusSeconds = Math.max(0, Number(options.searchRadiusSeconds ?? 1.5));
  const offsetStepSeconds = Math.max(0.02, Number(options.offsetStepSeconds ?? 0.1));
  const maxOffsetStepSeconds = Math.max(offsetStepSeconds, Number(options.maxOffsetStepSeconds ?? 0.6));
  const transitionPenalty = Math.max(0, Number(options.transitionPenalty ?? 0.08));

  const start = Math.min(...audioRegions.map((region) => Number(region.onset)));
  const end = Math.max(...audioRegions.map((region) => Number(region.end)));
  const windows = [];
  for (let windowStart = start; windowStart < end - EPSILON; windowStart += windowSeconds) {
    windows.push(Object.freeze({
      start: windowStart,
      end: Math.min(end, windowStart + windowSeconds),
      center: (windowStart + Math.min(end, windowStart + windowSeconds)) / 2
    }));
  }

  const offsets = offsetGrid(globalOffset, searchRadiusSeconds, offsetStepSeconds);
  const evidence = windows.map((window) =>
    offsets.map((offset) => windowEvidence(audioRegions, scoreRegions, offset, window.start, window.end))
  );

  const scores = windows.map(() => Array(offsets.length).fill(-Infinity));
  const back = windows.map(() => Array(offsets.length).fill(-1));

  for (let state = 0; state < offsets.length; state += 1) {
    scores[0][state] = evidence[0][state].objective -
      transitionPenalty * Math.abs(offsets[state] - globalOffset);
  }

  for (let windowIndex = 1; windowIndex < windows.length; windowIndex += 1) {
    for (let state = 0; state < offsets.length; state += 1) {
      for (let previous = 0; previous < offsets.length; previous += 1) {
        const delta = Math.abs(offsets[state] - offsets[previous]);
        if (delta > maxOffsetStepSeconds + EPSILON) continue;
        const candidate = scores[windowIndex - 1][previous] +
          evidence[windowIndex][state].objective -
          transitionPenalty * delta;
        if (candidate > scores[windowIndex][state]) {
          scores[windowIndex][state] = candidate;
          back[windowIndex][state] = previous;
        }
      }
    }
  }

  let state = scores.at(-1).reduce(
    (best, value, index, array) => value > array[best] ? index : best,
    0
  );
  const states = Array(windows.length);
  for (let windowIndex = windows.length - 1; windowIndex >= 0; windowIndex -= 1) {
    states[windowIndex] = state;
    state = back[windowIndex][state] >= 0 ? back[windowIndex][state] : state;
  }

  const knots = Object.freeze(windows.map((window, index) => {
    const item = evidence[index][states[index]];
    return Object.freeze({
      audioTimeSeconds: window.center,
      windowStartSeconds: window.start,
      windowEndSeconds: window.end,
      offsetSeconds: item.offset,
      localAgreement: item.agreement,
      localCoverage: item.coverage
    });
  }));

  const chosenOffsets = knots.map((knot) => knot.offsetSeconds);
  const minimumOffsetSeconds = Math.min(...chosenOffsets);
  const maximumOffsetSeconds = Math.max(...chosenOffsets);
  const meanOffsetSeconds = chosenOffsets.reduce((sum, value) => sum + value, 0) / chosenOffsets.length;
  const rmsDriftFromGlobalSeconds = Math.sqrt(
    chosenOffsets.reduce((sum, value) => sum + Math.pow(value - globalOffset, 2), 0) /
    chosenOffsets.length
  );

  return Object.freeze({
    version: LOCAL_TIMING_ALIGNMENT_VERSION,
    method: "validation-only-constrained-window-offset-path",
    globalOffsetSeconds: globalOffset,
    windowSeconds,
    searchRadiusSeconds,
    offsetStepSeconds,
    maxOffsetStepSeconds,
    knotCount: knots.length,
    knots,
    minimumOffsetSeconds,
    maximumOffsetSeconds,
    meanOffsetSeconds,
    driftRangeSeconds: maximumOffsetSeconds - minimumOffsetSeconds,
    rmsDriftFromGlobalSeconds,
    note: "This path is estimated only for score/audio validation. It does not modify audio pitch, chord, bass, or harmonic inference."
  });
}
