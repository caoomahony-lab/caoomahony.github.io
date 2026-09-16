import test from "node:test";
import assert from "node:assert/strict";
import { extractRootMotion, signedRootMotion } from "../src/fingerprint/blocks/root-motion.js";

test("signed root motion uses shortest directed semitone distance", () => {
  assert.equal(signedRootMotion(0,7), -5);
  assert.equal(signedRootMotion(7,0), 5);
  assert.equal(signedRootMotion(0,6), 6);
});

test("root-motion profile measures repeated, step, fifth-class and tritone motion", () => {
  const block = extractRootMotion([{rootPc:0},{rootPc:7},{rootPc:9},{rootPc:9},{rootPc:3}]);
  assert.equal(block.transitionCount, 4);
  assert.equal(block.directedDistribution.down5, 0.25);
  assert.equal(block.directedDistribution.up2, 0.25);
  assert.equal(block.repeatedRootRate, 0.25);
  assert.equal(block.tritoneRate, 0.25);
});

test("root-motion fingerprint is invariant under global transposition", () => {
  const a = extractRootMotion([0,9,5,7,0].map((rootPc) => ({rootPc})));
  const b = extractRootMotion([5,2,10,0,5].map((rootPc) => ({rootPc})));
  assert.deepEqual(a.directedDistribution, b.directedDistribution);
  assert.deepEqual(a.unsignedSemitoneClassDistribution, b.unsignedSemitoneClassDistribution);
});
