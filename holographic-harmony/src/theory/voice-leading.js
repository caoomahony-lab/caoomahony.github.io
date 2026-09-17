import { mod12 } from "./pitch.js";

const DEFAULT_MAX_VOICES = 8;
const EPSILON = 1e-9;

function assertInteger(value, label) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) throw new TypeError(`${label} must be an integer`);
  return numeric;
}

function assertNonNegative(value, label) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) throw new TypeError(`${label} must be a finite nonnegative number`);
  return numeric;
}

function normalizeMode(mode) {
  const normalized = mode ?? "registered";
  if (normalized !== "registered" && normalized !== "pitch-class") {
    throw new RangeError(`Unsupported voice-leading mode: ${normalized}`);
  }
  return normalized;
}

function normalizeVoicing(voicing, mode, label, maxVoices) {
  if (!Array.isArray(voicing) && !ArrayBuffer.isView(voicing)) {
    throw new TypeError(`${label} must be an array-like sequence`);
  }
  const values = Array.from(voicing, (value, index) => {
    const pitch = assertInteger(value, `${label}[${index}]`);
    if (mode === "registered" && (pitch < 0 || pitch > 127)) {
      throw new RangeError(`${label}[${index}] must be a MIDI pitch in 0..127`);
    }
    return mode === "pitch-class" ? mod12(pitch) : pitch;
  });
  if (!values.length) throw new RangeError(`${label} must contain at least one voice`);
  if (values.length > maxVoices) {
    throw new RangeError(`${label} exceeds the configured maximum of ${maxVoices} voices`);
  }
  return values.sort((a, b) => a - b);
}

function shortestSignedPitchClassMotion(sourcePc, targetPc) {
  const upward = mod12(targetPc - sourcePc);
  return upward <= 6 ? upward : upward - 12;
}

function chooseRegisteredTarget(sourceMidi, targetMidi, allowOctaveDisplacement, maxOctaveShift) {
  if (!allowOctaveDisplacement) {
    return { targetAdjusted: targetMidi, octaveShift: 0, signed: targetMidi - sourceMidi };
  }

  let best = null;
  for (let shift = -maxOctaveShift; shift <= maxOctaveShift; shift += 1) {
    const candidate = targetMidi + 12 * shift;
    if (candidate < 0 || candidate > 127) continue;
    const signed = candidate - sourceMidi;
    const record = {
      targetAdjusted: candidate,
      octaveShift: shift,
      signed,
      movement: Math.abs(signed)
    };
    if (
      !best ||
      record.movement < best.movement - EPSILON ||
      (Math.abs(record.movement - best.movement) <= EPSILON && Math.abs(shift) < Math.abs(best.octaveShift)) ||
      (Math.abs(record.movement - best.movement) <= EPSILON && Math.abs(shift) === Math.abs(best.octaveShift) && candidate < best.targetAdjusted)
    ) {
      best = record;
    }
  }
  if (!best) throw new RangeError("No legal octave-displaced target pitch remains inside MIDI 0..127");
  return best;
}

function buildPair(source, target, sourceIndex, targetIndex, options) {
  const sourcePitch = source[sourceIndex];
  const targetPitch = target[targetIndex];
  let signed;
  let targetAdjusted = targetPitch;
  let octaveShift = 0;

  if (options.mode === "pitch-class") {
    signed = shortestSignedPitchClassMotion(sourcePitch, targetPitch);
  } else {
    const adjusted = chooseRegisteredTarget(
      sourcePitch,
      targetPitch,
      options.allowOctaveDisplacement,
      options.maxOctaveShift
    );
    signed = adjusted.signed;
    targetAdjusted = adjusted.targetAdjusted;
    octaveShift = adjusted.octaveShift;
  }

  return {
    sourceIndex,
    targetIndex,
    sourcePitch,
    targetPitch,
    targetAdjusted,
    sourcePitchClass: mod12(sourcePitch),
    targetPitchClass: mod12(targetPitch),
    octaveShift,
    signedMovement: signed,
    movement: Math.abs(signed),
    commonTone: mod12(sourcePitch) === mod12(targetPitch)
  };
}

function countCrossings(pairs, mode) {
  if (mode !== "registered") return 0;
  let crossings = 0;
  for (let i = 0; i < pairs.length; i += 1) {
    for (let j = i + 1; j < pairs.length; j += 1) {
      const a = pairs[i];
      const b = pairs[j];
      const sourceOrder = Math.sign(a.sourcePitch - b.sourcePitch);
      const targetOrder = Math.sign(a.targetAdjusted - b.targetAdjusted);
      if (sourceOrder !== 0 && targetOrder !== 0 && sourceOrder !== targetOrder) crossings += 1;
    }
  }
  return crossings;
}

function assignmentKey(pairs) {
  return [...pairs]
    .sort((a, b) => a.sourceIndex - b.sourceIndex || a.targetIndex - b.targetIndex)
    .map((pair) => `${pair.sourceIndex}:${pair.targetIndex}:${pair.targetAdjusted}`)
    .join("|");
}

function describeMotion(pairs) {
  const movements = pairs.map((pair) => pair.signedMovement);
  const upCount = movements.filter((value) => value > 0).length;
  const downCount = movements.filter((value) => value < 0).length;
  const staticCount = movements.filter((value) => value === 0).length;
  const movingCount = upCount + downCount;
  const contraryMotion = upCount > 0 && downCount > 0;
  const similarMotion = movingCount >= 2 && !contraryMotion;
  const obliqueMotion = staticCount > 0 && movingCount > 0;
  const nonzero = movements.filter((value) => value !== 0);
  const parallelMotion = nonzero.length >= 2 && staticCount === 0 && nonzero.every((value) => value === nonzero[0]);

  let motionClass = "stationary";
  if (contraryMotion) motionClass = "contrary";
  else if (parallelMotion) motionClass = "parallel-chromatic";
  else if (obliqueMotion) motionClass = "oblique";
  else if (similarMotion) motionClass = "similar";
  else if (movingCount > 0) motionClass = "single-voice";

  return {
    upCount,
    downCount,
    staticCount,
    movingCount,
    contraryMotion,
    similarMotion,
    obliqueMotion,
    parallelMotion,
    motionClass
  };
}

function evaluateAssignment(source, target, pairs, unmatchedSourceIndices, unmatchedTargetIndices, options) {
  const movementSemitones = pairs.reduce((sum, pair) => sum + pair.movement, 0);
  const commonToneCount = pairs.filter((pair) => pair.commonTone).length;
  const crossingCount = countCrossings(pairs, options.mode);
  const unmatchedVoiceCount = unmatchedSourceIndices.length + unmatchedTargetIndices.length;
  const bassRetained = mod12(source[0]) === mod12(target[0]);
  const sopranoRetained = mod12(source[source.length - 1]) === mod12(target[target.length - 1]);

  const rawCost =
    movementSemitones +
    unmatchedVoiceCount * options.unmatchedVoicePenalty +
    crossingCount * options.voiceCrossingPenalty -
    commonToneCount * options.commonToneBonus -
    (bassRetained ? options.bassPreservationBonus : 0) -
    (sopranoRetained ? options.sopranoPreservationBonus : 0);
  const cost = Math.max(0, rawCost);

  return {
    pairs: [...pairs].sort((a, b) => a.sourceIndex - b.sourceIndex || a.targetIndex - b.targetIndex),
    unmatchedSourceIndices: [...unmatchedSourceIndices].sort((a, b) => a - b),
    unmatchedTargetIndices: [...unmatchedTargetIndices].sort((a, b) => a - b),
    movementSemitones,
    unmatchedVoiceCount,
    crossingCount,
    commonToneCount,
    bassRetained,
    sopranoRetained,
    rawCost,
    cost,
    key: assignmentKey(pairs)
  };
}

function betterAssignment(candidate, best) {
  if (!best) return true;
  if (candidate.cost < best.cost - EPSILON) return true;
  if (candidate.cost > best.cost + EPSILON) return false;
  if (candidate.movementSemitones < best.movementSemitones - EPSILON) return true;
  if (candidate.movementSemitones > best.movementSemitones + EPSILON) return false;
  if (candidate.crossingCount < best.crossingCount) return true;
  if (candidate.crossingCount > best.crossingCount) return false;
  return candidate.key < best.key;
}

function enumerateAssignments(source, target, options) {
  let best = null;

  if (source.length <= target.length) {
    const usedTargets = new Set();
    const pairs = [];
    const visit = (sourceIndex) => {
      if (sourceIndex === source.length) {
        const unmatchedTargets = target.map((_, index) => index).filter((index) => !usedTargets.has(index));
        const evaluated = evaluateAssignment(source, target, pairs, [], unmatchedTargets, options);
        if (betterAssignment(evaluated, best)) best = evaluated;
        return;
      }
      for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
        if (usedTargets.has(targetIndex)) continue;
        usedTargets.add(targetIndex);
        pairs.push(buildPair(source, target, sourceIndex, targetIndex, options));
        visit(sourceIndex + 1);
        pairs.pop();
        usedTargets.delete(targetIndex);
      }
    };
    visit(0);
  } else {
    const usedSources = new Set();
    const pairs = [];
    const visit = (targetIndex) => {
      if (targetIndex === target.length) {
        const unmatchedSources = source.map((_, index) => index).filter((index) => !usedSources.has(index));
        const evaluated = evaluateAssignment(source, target, pairs, unmatchedSources, [], options);
        if (betterAssignment(evaluated, best)) best = evaluated;
        return;
      }
      for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
        if (usedSources.has(sourceIndex)) continue;
        usedSources.add(sourceIndex);
        pairs.push(buildPair(source, target, sourceIndex, targetIndex, options));
        visit(targetIndex + 1);
        pairs.pop();
        usedSources.delete(sourceIndex);
      }
    };
    visit(0);
  }

  return best;
}

export function voiceLeadingDistance(sourceVoicing, targetVoicing, options = {}) {
  const mode = normalizeMode(options.mode);
  const maxVoices = assertInteger(options.maxVoices ?? DEFAULT_MAX_VOICES, "maxVoices");
  if (maxVoices < 1) throw new RangeError("maxVoices must be at least 1");

  const normalizedOptions = {
    mode,
    maxVoices,
    allowOctaveDisplacement: options.allowOctaveDisplacement === true,
    maxOctaveShift: assertInteger(options.maxOctaveShift ?? 2, "maxOctaveShift"),
    unmatchedVoicePenalty: assertNonNegative(options.unmatchedVoicePenalty ?? 12, "unmatchedVoicePenalty"),
    voiceCrossingPenalty: assertNonNegative(options.voiceCrossingPenalty ?? 0, "voiceCrossingPenalty"),
    commonToneBonus: assertNonNegative(options.commonToneBonus ?? 0, "commonToneBonus"),
    bassPreservationBonus: assertNonNegative(options.bassPreservationBonus ?? 0, "bassPreservationBonus"),
    sopranoPreservationBonus: assertNonNegative(options.sopranoPreservationBonus ?? 0, "sopranoPreservationBonus")
  };
  if (normalizedOptions.maxOctaveShift < 0) throw new RangeError("maxOctaveShift must be nonnegative");
  if (mode === "pitch-class" && normalizedOptions.allowOctaveDisplacement) {
    throw new RangeError("allowOctaveDisplacement applies only to registered mode");
  }

  const source = normalizeVoicing(sourceVoicing, mode, "sourceVoicing", maxVoices);
  const target = normalizeVoicing(targetVoicing, mode, "targetVoicing", maxVoices);
  const best = enumerateAssignments(source, target, normalizedOptions);
  if (!best) throw new Error("No legal voice-leading assignment was found");

  const motion = describeMotion(best.pairs);
  const matchedVoiceCount = best.pairs.length;
  const movingPairs = best.pairs.filter((pair) => pair.movement > 0);
  const stepwiseMovingCount = movingPairs.filter((pair) => pair.movement <= 2).length;
  const largeLeapCount = movingPairs.filter((pair) => pair.movement > 5).length;

  return Object.freeze({
    mode,
    source: Object.freeze([...source]),
    target: Object.freeze([...target]),
    matchedVoiceCount,
    unmatchedVoiceCount: best.unmatchedVoiceCount,
    movementSemitones: best.movementSemitones,
    cost: best.cost,
    rawCost: best.rawCost,
    commonToneCount: best.commonToneCount,
    commonToneRetention: matchedVoiceCount ? best.commonToneCount / matchedVoiceCount : 0,
    bassRetained: best.bassRetained,
    sopranoRetained: best.sopranoRetained,
    crossingCount: best.crossingCount,
    stepwiseMovingFraction: movingPairs.length ? stepwiseMovingCount / movingPairs.length : 0,
    largeLeapFraction: movingPairs.length ? largeLeapCount / movingPairs.length : 0,
    motion: Object.freeze(motion),
    pairs: Object.freeze(best.pairs.map((pair) => Object.freeze({ ...pair }))),
    unmatchedSourceIndices: Object.freeze([...best.unmatchedSourceIndices]),
    unmatchedTargetIndices: Object.freeze([...best.unmatchedTargetIndices]),
    options: Object.freeze({ ...normalizedOptions })
  });
}

export function voiceLeadingDistanceValue(sourceVoicing, targetVoicing, options = {}) {
  return voiceLeadingDistance(sourceVoicing, targetVoicing, options).cost;
}
