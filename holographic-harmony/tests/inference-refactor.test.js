import test from "node:test";
import assert from "node:assert/strict";
import { inferScaleCandidates, inferScaleCandidatesForCenter } from "../src/inference/scales.js";
import { inferCenterCandidates } from "../src/inference/centers.js";

function histogram(pcs, weights = []) {
  const out = Array(12).fill(0);
  pcs.forEach((pc, index) => { out[pc] += weights[index] ?? 1; });
  return out;
}

test("scale inference labels support as relative evidence, not calibrated confidence", () => {
  const activity = histogram([0,2,4,5,7,9,11], [5,2,3,2,5,2,2]);
  const candidates = inferScaleCandidates(activity, { limit: 5 });
  assert.equal(candidates[0].rootPc, 0);
  assert.equal(candidates[0].systemId, "major");
  assert.ok(candidates[0].support <= 1 && candidates[0].support >= 0);
  assert.ok("relativeWeight" in candidates[0]);
  assert.equal("confidence" in candidates[0], false);
});

test("center-scoped scale inference does not drift to a different tonic", () => {
  const activity = histogram([6,8,10,11,1,3,5], [7,2,3,2,6,2,2]);
  const candidates = inferScaleCandidatesForCenter(activity, 6, { limit: 4 });
  assert.ok(candidates.every((candidate) => candidate.rootPc === 6));
  assert.equal(candidates[0].systemId, "major");
});

test("center inference preserves multiple hypotheses", () => {
  const activity = histogram([0,2,4,5,7,9,11], [4,1,2,1,4,1,1]);
  const candidates = inferCenterCandidates(activity, { limit: 4 });
  assert.equal(candidates.length, 4);
  assert.equal(candidates[0].centerPc, 0);
  assert.ok(candidates[1].relativeWeight > 0);
  const weightSum = candidates.reduce((sum, candidate) => sum + candidate.relativeWeight, 0);
  assert.ok(Math.abs(weightSum - 1) < 1e-9);
});

test("bass evidence can alter center support without becoming a hard override", () => {
  const activity = histogram([0,2,4,5,7,9,11], [2,1,1,1,2,1,1]);
  const bass = histogram([7], [20]);
  const withBass = inferCenterCandidates(activity, { bassActivity: bass, limit: 12 });
  const g = withBass.find((candidate) => candidate.centerPc === 7);
  assert.ok(g.bassRootShare > 0.9);
  assert.ok(g.support <= 1);
});
