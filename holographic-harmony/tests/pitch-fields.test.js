import test from "node:test";
import assert from "node:assert/strict";
import { pitchClassFromStepAlter, midiFromPitch, mod12 } from "../src/theory/pitch.js";
import { complementField, validatePartition, reciprocalSubstitution } from "../src/theory/fields.js";

test("pitch classes collapse octave and preserve alterations", () => {
  assert.equal(pitchClassFromStepAlter("B", 0), 11);
  assert.equal(pitchClassFromStepAlter("E", 1), 5); // E# sounds F
  assert.equal(pitchClassFromStepAlter("C", -1), 11);
  assert.equal(midiFromPitch("C", 0, 4), 60);
  assert.equal(mod12(-1), 11);
});

test("B Lydian and C-major pentatonic form an exact Z12 partition", () => {
  const bLydian = [11, 1, 3, 5, 6, 8, 10];
  const shadow = complementField(bLydian);
  assert.deepEqual(shadow, [0, 2, 4, 7, 9]);
  assert.deepEqual(validatePartition(bLydian, shadow), {
    valid: true,
    intersection: [],
    unionSize: 12,
    activeSize: 7,
    shadowSize: 5
  });
});

test("reciprocal substitution moves one pitch between active and shadow", () => {
  const bMajor = [11, 1, 3, 4, 6, 8, 10];
  const result = reciprocalSubstitution(bMajor, 4, 5); // E -> E#(F)
  assert.deepEqual(result.active, [1, 3, 5, 6, 8, 10, 11]);
  assert.deepEqual(result.shadow, [0, 2, 4, 7, 9]);
  assert.equal(validatePartition(result.active, result.shadow).valid, true);
});
