import test from "node:test";
import assert from "node:assert/strict";
import { inferScoreHarmony, SCORE_HARMONY_VERSION } from "../src/inference/score-harmony.js";

function note(midi, onsetSec, durationSec, extra = {}) {
  return {
    id: extra.id ?? `n-${midi}-${onsetSec}`,
    midi,
    pitchClass: ((midi % 12) + 12) % 12,
    onsetSec,
    durationSec,
    endSec: onsetSec + durationSec,
    ...extra
  };
}

test("score harmony derives C-major then G-major from score change boundaries", () => {
  const notes = [
    note(48, 0, 1), note(52, 0, 1), note(55, 0, 1),
    note(43, 1, 1), note(47, 1, 1), note(50, 1, 1)
  ];
  const result = inferScoreHarmony(notes);
  assert.equal(result.version, SCORE_HARMONY_VERSION);
  assert.equal(result.regionCount, 2);
  assert.deepEqual(result.regions.map((region) => region.measuredPitchClasses), [[0, 4, 7], [2, 7, 11]]);
  assert.deepEqual(result.regions.map((region) => region.symbol), ["C", "G"]);
});

test("score harmony measures bass from the lowest sounding MIDI note", () => {
  const result = inferScoreHarmony([
    note(67, 0, 1),
    note(60, 0, 1),
    note(52, 0, 1)
  ]);
  assert.equal(result.regions[0].measuredBassMidi, 52);
  assert.equal(result.regions[0].bassPc, 4);
  assert.match(result.regions[0].candidates[0].symbol, /\/E$/);
});

test("score boundaries with passing and held notes never create zero-duration regions", () => {
  const result = inferScoreHarmony([
    note(48, 0, 2),
    note(52, 0, 2),
    note(55, 0, 2),
    note(62, 0.75, 0.25),
    note(72, 1, 0)
  ]);
  assert.ok(result.regionCount >= 1);
  assert.ok(result.regions.every((region) => region.duration > 0));
  assert.ok(result.regions.every((region) => region.end > region.onset));
});

test("adjacent tied score events continue sounding as one equivalent region", () => {
  const result = inferScoreHarmony([
    note(48, 0, 1, { id: "c-a", tieStart: true }),
    note(48, 1, 1, { id: "c-b", tieStop: true }),
    note(52, 0, 2),
    note(55, 0, 2)
  ]);
  assert.equal(result.regionCount, 1);
  assert.equal(result.regions[0].onset, 0);
  assert.equal(result.regions[0].end, 2);
  assert.equal(result.regions[0].mergedIntervalCount, 2);
  assert.deepEqual(result.regions[0].measuredPitchClasses, [0, 4, 7]);
});

test("measured score sonority remains separate from inferred chord interpretation", () => {
  const result = inferScoreHarmony([note(48, 0, 1), note(52, 0, 1), note(55, 0, 1)]);
  const region = result.regions[0];
  assert.equal(region.measuredEvidenceClass, "measured-from-score");
  assert.equal(region.interpretationEvidenceClass, "inferred-from-score-sonority");
  assert.deepEqual(region.measuredPitchClasses, [0, 4, 7]);
  assert.equal(region.candidates[0].evidenceClass, "inferred-from-score-sonority");
  assert.match(result.note, /measured.*inferred/i);
});
