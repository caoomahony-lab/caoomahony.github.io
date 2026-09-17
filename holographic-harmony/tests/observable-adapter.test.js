import test from "node:test";
import assert from "node:assert/strict";
import {
  mountObservableHolographicHarmony,
  mountObservableHarmonicSavant
} from "../observable/adapter.js";

test("Observable adapter exports both legacy and Harmonic Savant mounts", () => {
  assert.equal(typeof mountObservableHolographicHarmony, "function");
  assert.equal(typeof mountObservableHarmonicSavant, "function");
});

test("Observable mounts fail closed before DOM construction when required inputs are missing", async () => {
  await assert.rejects(() => mountObservableHolographicHarmony(null, []), /host element/);
  await assert.rejects(() => mountObservableHarmonicSavant(null, []), /host element/);
  const fakeRoot = {};
  await assert.rejects(() => mountObservableHolographicHarmony(fakeRoot, []), /resolved track/);
  await assert.rejects(() => mountObservableHarmonicSavant(fakeRoot, []), /resolved track/);
});
