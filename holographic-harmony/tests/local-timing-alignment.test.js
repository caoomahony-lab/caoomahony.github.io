import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateConstrainedLocalAlignment,
  LOCAL_TIMING_ALIGNMENT_VERSION
} from "../src/validation/local-timing-alignment.js";

function region(onset, end, rootPc) {
  return {
    onset,
    end,
    rootPc,
    pcs: [rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12]
  };
}

test("constrained local alignment follows gradual performance drift without changing note evidence", () => {
  const score = [
    region(0, 4, 0),
    region(4, 8, 1),
    region(8, 12, 2),
    region(12, 16, 3),
    region(16, 20, 4),
    region(20, 24, 5)
  ];
  const audio = [
    region(1.0, 5.0, 0),
    region(5.0, 9.0, 1),
    region(9.0, 13.0, 2),
    region(13.8, 17.8, 3),
    region(17.8, 21.8, 4),
    region(21.8, 25.8, 5)
  ];

  const result = estimateConstrainedLocalAlignment(audio, score, {
    globalOffsetSeconds: 1.4,
    windowSeconds: 8,
    searchRadiusSeconds: 1.0,
    offsetStepSeconds: 0.1,
    maxOffsetStepSeconds: 0.8,
    transitionPenalty: 0.03
  });

  assert.equal(result.version, LOCAL_TIMING_ALIGNMENT_VERSION);
  assert.ok(result.knotCount >= 3);
  assert.ok(result.knots[0].offsetSeconds < result.knots.at(-1).offsetSeconds);
  assert.ok(result.driftRangeSeconds >= 0.5);
  assert.match(result.note, /does not modify audio pitch/i);
});

test("local alignment stays near one offset when the timelines have no drift", () => {
  const score = [region(0, 4, 0), region(4, 8, 2), region(8, 12, 4)];
  const audio = [region(1.2, 5.2, 0), region(5.2, 9.2, 2), region(9.2, 13.2, 4)];
  const result = estimateConstrainedLocalAlignment(audio, score, {
    globalOffsetSeconds: 1.2,
    windowSeconds: 4,
    searchRadiusSeconds: 0.8,
    offsetStepSeconds: 0.1
  });
  assert.ok(result.rmsDriftFromGlobalSeconds <= 0.15);
});
