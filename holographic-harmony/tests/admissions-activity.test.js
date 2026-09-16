import test from "node:test";
import assert from "node:assert/strict";
import { computeAdmissionHistory, compareAdmissionOrder } from "../src/theory/admissions.js";
import { computePitchClassActivity, recentFlashStrength } from "../src/theory/activity.js";

const events = [
  { onset: 0, duration: 1, pitchClass: 11 },
  { onset: 1, duration: 1, pitchClass: 6 },
  { onset: 2, duration: 1, pitchClass: 2 },
  { onset: 3, duration: 1, pitchClass: 9 },
  { onset: 4, duration: 1, pitchClass: 4 },
  { onset: 5, duration: 1, pitchClass: 0 },
  { onset: 6, duration: 1, pitchClass: 7 },
  { onset: 6.5, duration: .25, pitchClass: 7 }
];

test("paper admission sequence is recovered in first-entry order", () => {
  const shadow = [0, 2, 4, 7, 9];
  const history = computeAdmissionHistory(events, shadow, 7, { persistenceWindow: 8, persistentCount: 2 });
  assert.deepEqual(history.admittedPcs, [2, 9, 4, 0, 7]);
  assert.equal(history.completion, 1);
  assert.equal(history.ordered.at(-1).persistent, true);
  assert.deepEqual(compareAdmissionOrder(history.admittedPcs, [2, 9, 4, 0, 7]), {
    matchedPrefix: 5,
    exactSoFar: true,
    complete: true
  });
});

test("activity is octave-independent pitch-class heat and decays", () => {
  const at6 = computePitchClassActivity(events, 6);
  assert.ok(at6.raw[7] > 0);
  assert.ok(at6.normalized[7] > 0);
  const muchLater = computePitchClassActivity(events, 40);
  assert.equal(muchLater.raw.reduce((a, b) => a + b, 0), 0);
});

test("a recent note can produce a white-flash strength", () => {
  assert.ok(recentFlashStrength(events, 6.1, 7, 0.7) > 0.8);
  assert.equal(recentFlashStrength(events, 8, 7, 0.7), 0);
});
