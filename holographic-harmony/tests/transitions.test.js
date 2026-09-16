import test from "node:test";
import assert from "node:assert/strict";
import { extractChordTransitions } from "../src/fingerprint/blocks/transitions.js";

test("functional transitions and ngrams are counted", () => {
  const block = extractChordTransitions(["I","vi","IV","V","I"]);
  assert.equal(block.transitionCounts["I→vi"], 1);
  assert.equal(block.transitionCounts["V→I"], 1);
  assert.equal(block.ngrams[4]["I→vi→IV→V"], 1);
});

test("repeated subdivision is compressed by default", () => {
  const block = extractChordTransitions(["I","I","I","V","V","I"]);
  assert.deepEqual(block.sequence, ["I","V","I"]);
  assert.equal(block.originalStateCount, 6);
  assert.equal(block.stateCount, 3);
});

test("conditional entropy is zero for deterministic outgoing behavior", () => {
  const block = extractChordTransitions(["I","V","I","V","I"]);
  assert.equal(block.conditionalEntropyBits, 0);
});
