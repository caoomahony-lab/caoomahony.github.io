import test from "node:test";
import assert from "node:assert/strict";
import { inferScaleCandidates, crystallizationSupport } from "../src/theory/inference.js";

test("B Lydian activity ranks a compatible B/F# collection near the top", () => {
  const raw = Array(12).fill(0.05);
  for (const pc of [11, 1, 3, 5, 6, 8, 10]) raw[pc] = 2;
  raw[11] = 3;
  const candidates = inferScaleCandidates(raw, 8);
  assert.ok(candidates.some((c) => c.label === "B Lydian"));
  assert.ok(candidates.every((c) => c.confidence >= 0 && c.confidence <= 1));
});

test("crystallization support rises with complete shadow admission", () => {
  const normalized = Array(12).fill(0.05);
  for (const pc of [0, 2, 4, 7, 9]) normalized[pc] = 0.8;
  normalized[0] = 1;
  normalized[7] = 0.9;
  const support = crystallizationSupport({
    activityNormalized: normalized,
    shadowField: [0, 2, 4, 7, 9],
    admittedPcs: [2, 9, 4, 0, 7],
    latentCenter: 0
  });
  assert.ok(support.score > 0.75);
  assert.equal(support.completion, 1);
});
