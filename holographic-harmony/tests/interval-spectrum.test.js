import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { parseMusicXML } from "../src/music/musicxml.js";
import { transposeEvents } from "../src/theory/transposition.js";
import { extractIntervalSpectrum } from "../src/fingerprint/blocks/interval-spectrum.js";

const xml = fs.readFileSync(new URL("../public/tracks/demo.musicxml", import.meta.url), "utf8");
const parsed = parseMusicXML(xml, LiteDOMParser, { trackId: "interval-demo" });

test("a C-major triad distributes equally across IC3, IC4, and IC5", () => {
  const events = [
    { onsetSec: 0, endSec: 2, pitchClass: 0 },
    { onsetSec: 0, endSec: 2, pitchClass: 4 },
    { onsetSec: 0, endSec: 2, pitchClass: 7 }
  ];
  const block = extractIntervalSpectrum(events);
  assert.deepEqual(block.distribution, [0, 0, 1 / 3, 1 / 3, 1 / 3, 0]);
  assert.equal(block.thirdsSixthsShare, 2 / 3);
  assert.equal(block.fourthFifthShare, 1 / 3);
  assert.equal(block.tritoneShare, 0);
});

test("interval spectrum is invariant under transposition", () => {
  const baseline = extractIntervalSpectrum(parsed.eventsV1);
  const shifted = extractIntervalSpectrum(transposeEvents(parsed.eventsV1, 5));
  assert.deepEqual(shifted.distribution, baseline.distribution);
  assert.deepEqual(shifted.localVarianceByClass, baseline.localVarianceByClass);
  assert.equal(shifted.fourthFifthShare, baseline.fourthFifthShare);
  assert.equal(shifted.thirdsSixthsShare, baseline.thirdsSixthsShare);
  assert.equal(shifted.tritoneShare, baseline.tritoneShare);
});

test("interval spectrum can be clipped to a requested time range", () => {
  const full = extractIntervalSpectrum(parsed.eventsV1);
  const early = extractIntervalSpectrum(parsed.eventsV1, { rangeStartSec: 0, rangeEndSec: 4 });
  assert.ok(full.segmentCount >= early.segmentCount);
  assert.ok(early.weightedPairDuration >= 0);
  assert.ok(early.dissonanceConcentration >= 0 && early.dissonanceConcentration <= 1);
});
