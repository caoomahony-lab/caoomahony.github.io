import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { parseMusicXML } from "../src/music/musicxml.js";
import { transposeEvents, transposePitchClass, transposePitchSet } from "../src/theory/transposition.js";
import { extractBassGravity } from "../src/fingerprint/blocks/bass-gravity.js";

const xml = fs.readFileSync(new URL("../public/tracks/demo.musicxml", import.meta.url), "utf8");
const parsed = parseMusicXML(xml, LiteDOMParser, { trackId: "bass-demo" });
const centerPc = 11;
const field = [11, 1, 3, 5, 6, 8, 10];

test("bass gravity measures sounding bass duration separately from attack contexts", () => {
  const events = [
    { onsetSec: 0, endSec: 4, midi: 48, pitchClass: 0 },
    { onsetSec: 1, endSec: 2, midi: 67, pitchClass: 7 },
    { onsetSec: 2, endSec: 3, midi: 64, pitchClass: 4 },
    { onsetSec: 4, endSec: 6, midi: 43, pitchClass: 7 }
  ];
  const block = extractBassGravity(events, { centerPc: 0, referenceField: [0, 2, 4, 5, 7, 9, 11] });
  assert.ok(block.durationWeightedDistribution[0] > block.durationWeightedDistribution[7]);
  assert.equal(block.stateCount, 2);
  assert.equal(block.fourthFifthMotionRate, 1);
  assert.equal(block.chromaticBassRate, 0);
});

test("bass gravity is transposition invariant when center and field move with events", () => {
  const baseline = extractBassGravity(parsed.eventsV1, { centerPc, referenceField: field });
  const shift = 5;
  const shifted = extractBassGravity(transposeEvents(parsed.eventsV1, shift), {
    centerPc: transposePitchClass(centerPc, shift),
    referenceField: transposePitchSet(field, shift)
  });
  assert.deepEqual(shifted.durationWeightedDistribution, baseline.durationWeightedDistribution);
  assert.deepEqual(shifted.onsetWeightedDistribution, baseline.onsetWeightedDistribution);
  assert.deepEqual(shifted.intervalClassTransitionHistogram, baseline.intervalClassTransitionHistogram);
  assert.equal(shifted.fourthFifthMotionRate, baseline.fourthFifthMotionRate);
  assert.equal(shifted.stepwiseBassRate, baseline.stepwiseBassRate);
  assert.ok(Math.abs(shifted.pedalPersistence - baseline.pedalPersistence) < 1e-12);
});

test("bass gravity reports normalized distributions and bounded rates", () => {
  const block = extractBassGravity(parsed.eventsV1, { centerPc, referenceField: field });
  assert.ok(Math.abs(block.durationWeightedDistribution.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.ok(Math.abs(block.onsetWeightedDistribution.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.ok(block.bassRepetitionProbability >= 0 && block.bassRepetitionProbability <= 1);
  assert.ok(block.pedalPersistence >= 0 && block.pedalPersistence <= 1);
  assert.ok(block.dominantBassDegree >= 0 && block.dominantBassDegree <= 11);
});
