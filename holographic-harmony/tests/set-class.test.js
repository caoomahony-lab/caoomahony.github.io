import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePitchClassSet,
  normalOrder,
  primeForm,
  intervalClassVector,
  complementPitchClassSet,
  describeSetClass,
  areTranspositionallyEquivalent,
  areInversionallyEquivalent
} from "../src/theory/set-class.js";

test("set-class normalization is sorted, unique, and modulo 12", () => {
  assert.deepEqual(normalizePitchClassSet([12, 7, 4, 0, -5, 4]), [0, 4, 7]);
});

test("major triad normal order and interval-class vector are deterministic", () => {
  assert.deepEqual(normalOrder([7, 0, 4]), [0, 4, 7]);
  assert.deepEqual(intervalClassVector([0, 4, 7]), [0, 0, 1, 1, 1, 0]);
});

test("prime form is invariant under transposition and inversion", () => {
  const base = primeForm([0, 2, 5, 7]);
  assert.deepEqual(primeForm([5, 7, 10, 0]), base);
  assert.deepEqual(primeForm([0, 10, 7, 5]), base);
  assert.equal(areTranspositionallyEquivalent([0,4,7], [2,6,9]), true);
  assert.equal(areInversionallyEquivalent([0,4,7], [0,3,7]), true);
});

test("complement is exact Z12 complement", () => {
  const complement = complementPitchClassSet([11,1,3,5,6,8,10]);
  assert.deepEqual(complement, [0,2,4,7,9]);
});

test("descriptor records deterministic class identities", () => {
  const a = describeSetClass([0,4,7]);
  const b = describeSetClass([6,10,1]);
  assert.equal(a.cardinality, 3);
  assert.equal(a.transpositionClassKey, b.transpositionClassKey);
  assert.deepEqual(a.intervalClassVector, [0,0,1,1,1,0]);
  assert.ok(Object.isFrozen(a));
});
