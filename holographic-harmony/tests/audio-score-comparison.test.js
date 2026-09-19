import test from "node:test";
import assert from "node:assert/strict";
import {
  compareAudioToScore,
  AUDIO_SCORE_COMPARISON_VERSION
} from "../src/validation/audio-score-comparison.js";

function audioRegion(onset, end, rootPc, templateId, pcs, microSegmentCount = 1) {
  return { onset, end, rootPc, templateId, pcs, observedPitchClasses: pcs, microSegmentCount };
}

function scoreRegion(onset, end, rootPc, templateId, pcs) {
  return { onset, end, rootPc, templateId, pcs, measuredPitchClasses: pcs };
}

test("bounded offset search recovers a known audio-minus-score delay", () => {
  const score = [
    scoreRegion(0, 2, 0, "major", [0, 4, 7]),
    scoreRegion(2, 4, 7, "major", [2, 7, 11])
  ];
  const audio = [
    audioRegion(2, 4, 0, "major", [0, 4, 7], 3),
    audioRegion(4, 6, 7, "major", [2, 7, 11], 2)
  ];
  const result = compareAudioToScore(audio, score, {
    maxOffsetSeconds: 3,
    offsetStepSeconds: 0.1,
    boundaryToleranceSeconds: 0.2
  });
  assert.equal(result.version, AUDIO_SCORE_COMPARISON_VERSION);
  assert.ok(Math.abs(result.estimatedAudioMinusScoreOffsetSeconds - 2) < 1e-9);
  assert.equal(result.coverage.audioCoverageShare, 1);
  assert.equal(result.agreement.timeWeightedRootAgreement, 1);
  assert.equal(result.agreement.timeWeightedExactPitchSetAgreement, 1);
  assert.equal(result.boundaries.precision, 1);
  assert.equal(result.boundaries.recall, 1);
  assert.equal(result.counts.microSegmentCount, 5);
});

test("comparison reports root and quality confusions instead of hiding them in one score", () => {
  const result = compareAudioToScore(
    [audioRegion(0, 2, 0, "minor", [0, 3, 7])],
    [scoreRegion(0, 2, 7, "major", [2, 7, 11])],
    { maxOffsetSeconds: 0 }
  );
  assert.equal(result.agreement.timeWeightedRootAgreement, 0);
  assert.deepEqual(result.rootConfusions, [{ scoreRootPc: 7, audioRootPc: 0, seconds: 2 }]);
  assert.equal(result.evidenceClasses.scoreSonority, "measured-from-score");
  assert.equal(result.evidenceClasses.scoreChordInterpretation, "inferred-from-score-sonority");
  assert.match(result.note, /inferences/);
});

test("pitch-set diagnostics distinguish exact from related overlap and expose unresolved coverage", () => {
  const result = compareAudioToScore(
    [
      audioRegion(0, 2, 0, "major7", [0, 4, 7, 11]),
      audioRegion(2, 4, 5, "major", [0, 5, 9])
    ],
    [scoreRegion(0, 2, 0, "major", [0, 4, 7])],
    { maxOffsetSeconds: 0 }
  );
  assert.equal(result.coverage.audioCoverageShare, 0.5);
  assert.equal(result.coverage.unresolvedAudioSeconds, 2);
  assert.ok(result.agreement.timeWeightedPitchSetJaccard > 0);
  assert.ok(result.agreement.timeWeightedPitchSetJaccard < 1);
  assert.equal(result.agreement.timeWeightedExactPitchSetAgreement, 0);
  assert.deepEqual(result.qualityConfusions, [{
    scoreTemplateId: "major",
    audioTemplateId: "major7",
    seconds: 2
  }]);
});
