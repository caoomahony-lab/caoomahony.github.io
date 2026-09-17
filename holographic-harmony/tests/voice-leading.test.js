import test from "node:test";
import assert from "node:assert/strict";
import { voiceLeadingDistance, voiceLeadingDistanceValue } from "../src/theory/voice-leading.js";

test("registered voice leading finds minimum total semitone movement", () => {
  const result = voiceLeadingDistance([60, 64, 67], [60, 65, 69]);
  assert.equal(result.movementSemitones, 3);
  assert.equal(result.cost, 3);
  assert.equal(result.commonToneCount, 1);
  assert.equal(result.commonToneRetention, 1 / 3);
  assert.equal(result.bassRetained, true);
  assert.equal(result.sopranoRetained, false);
  assert.equal(result.stepwiseMovingFraction, 1);
  assert.equal(result.largeLeapFraction, 0);
  assert.equal(voiceLeadingDistanceValue([60, 64, 67], [60, 65, 69]), 3);
});

test("voice-leading assignment is independent of input note ordering", () => {
  const a = voiceLeadingDistance([67, 60, 64], [69, 60, 65]);
  const b = voiceLeadingDistance([60, 64, 67], [60, 65, 69]);
  assert.equal(a.movementSemitones, b.movementSemitones);
  assert.deepEqual(a.source, b.source);
  assert.deepEqual(a.target, b.target);
  assert.deepEqual(a.pairs, b.pairs);
});

test("pitch-class mode measures circular motion rather than registered distance", () => {
  const registered = voiceLeadingDistance([60], [71]);
  const pitchClass = voiceLeadingDistance([60], [71], { mode: "pitch-class" });
  assert.equal(registered.movementSemitones, 11);
  assert.equal(pitchClass.movementSemitones, 1);
  assert.equal(pitchClass.pairs[0].signedMovement, -1);
});

test("optional octave displacement can preserve a pitch class in a nearby register", () => {
  const fixed = voiceLeadingDistance([60], [72]);
  const flexible = voiceLeadingDistance([60], [72], {
    allowOctaveDisplacement: true,
    maxOctaveShift: 1
  });
  assert.equal(fixed.movementSemitones, 12);
  assert.equal(flexible.movementSemitones, 0);
  assert.equal(flexible.commonToneCount, 1);
  assert.equal(flexible.pairs[0].octaveShift, -1);
  assert.equal(flexible.pairs[0].targetAdjusted, 60);
});

test("voice-count changes remain explicit through unmatched-voice penalty", () => {
  const result = voiceLeadingDistance([60, 64, 67], [59, 62, 65, 67]);
  assert.equal(result.matchedVoiceCount, 3);
  assert.equal(result.unmatchedVoiceCount, 1);
  assert.equal(result.unmatchedTargetIndices.length, 1);
  assert.ok(result.cost >= result.movementSemitones + 12);
});

test("common-tone preference and crossing penalty remain independent objectives", () => {
  const commonToneFavored = voiceLeadingDistance([60, 61], [61, 72], {
    commonToneBonus: 10
  });
  assert.equal(commonToneFavored.commonToneCount, 2);
  assert.equal(commonToneFavored.crossingCount, 1);

  const crossingAvoided = voiceLeadingDistance([60, 61], [61, 72], {
    commonToneBonus: 10,
    voiceCrossingPenalty: 20
  });
  assert.equal(crossingAvoided.crossingCount, 0);
  assert.equal(crossingAvoided.commonToneCount, 0);
});

test("motion descriptors distinguish contrary, parallel-chromatic, and oblique movement", () => {
  const contrary = voiceLeadingDistance([60, 64], [59, 65]);
  assert.equal(contrary.motion.contraryMotion, true);
  assert.equal(contrary.motion.motionClass, "contrary");

  const parallel = voiceLeadingDistance([60, 64], [62, 66]);
  assert.equal(parallel.motion.parallelMotion, true);
  assert.equal(parallel.motion.motionClass, "parallel-chromatic");

  const oblique = voiceLeadingDistance([60, 64], [60, 65]);
  assert.equal(oblique.motion.obliqueMotion, true);
  assert.equal(oblique.motion.motionClass, "oblique");
});

test("pitch-class voice-leading cost is invariant under matched global transposition", () => {
  const original = voiceLeadingDistance([60, 64, 67], [62, 65, 69], { mode: "pitch-class" });
  const transposed = voiceLeadingDistance([65, 69, 72], [67, 70, 74], { mode: "pitch-class" });
  assert.equal(original.movementSemitones, transposed.movementSemitones);
  assert.equal(original.cost, transposed.cost);
  assert.equal(original.commonToneCount, transposed.commonToneCount);
  assert.deepEqual(original.motion, transposed.motion);
});

test("voice-leading inputs and options fail closed when unsupported", () => {
  assert.throws(() => voiceLeadingDistance([], [60]), /at least one voice/);
  assert.throws(() => voiceLeadingDistance([128], [60]), /0\.\.127/);
  assert.throws(() => voiceLeadingDistance([60], [61], { mode: "unknown" }), /Unsupported/);
  assert.throws(
    () => voiceLeadingDistance([60], [61], { mode: "pitch-class", allowOctaveDisplacement: true }),
    /registered mode/
  );
  assert.throws(() => voiceLeadingDistance(Array(9).fill(60), [60]), /maximum of 8 voices/);
});
