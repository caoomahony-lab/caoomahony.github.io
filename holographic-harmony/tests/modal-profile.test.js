import test from "node:test";
import assert from "node:assert/strict";
import { extractModalProfile } from "../src/fingerprint/blocks/modal-profile.js";

test("single-center frames have low ambiguity", () => {
  const block = extractModalProfile([
    { candidates: [{rootPc:0,systemId:"major",relativeWeight:1}] },
    { candidates: [{rootPc:0,systemId:"major",relativeWeight:1}] }
  ]);
  assert.equal(block.ambiguityMean, 0);
  assert.equal(block.centerChangeRate, 0);
  assert.equal(block.centerOccupancy[0], 1);
});

test("balanced competing centers produce high ambiguity and pair evidence", () => {
  const block = extractModalProfile([
    { candidates: [{rootPc:0,systemId:"major",relativeWeight:0.5},{rootPc:7,systemId:"mixolydian",relativeWeight:0.5}] }
  ]);
  assert.ok(block.ambiguityMean > 0.99);
  assert.deepEqual(block.dualCenterPairs[0], {a:0,b:7,weight:1});
});

test("relative modal profile is invariant under matched transposition", () => {
  const a = extractModalProfile([{ candidates: [{rootPc:0,systemId:"major",relativeWeight:0.7},{rootPc:5,systemId:"lydian",relativeWeight:0.3}] }], { referenceCenterPc: 0 });
  const b = extractModalProfile([{ candidates: [{rootPc:6,systemId:"major",relativeWeight:0.7},{rootPc:11,systemId:"lydian",relativeWeight:0.3}] }], { referenceCenterPc: 6 });
  assert.deepEqual(a.centerOccupancy, b.centerOccupancy);
  assert.deepEqual(a.systemOccupancy, b.systemOccupancy);
});
