import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { parseMusicXML } from "../src/music/musicxml.js";
import { transposeEvents, transposePitchClass, transposePitchSet } from "../src/theory/transposition.js";
import {
  RELATIVE_CHROMATIC_DEGREE_LABELS,
  extractPitchEcology
} from "../src/fingerprint/blocks/pitch-ecology.js";

const xml = fs.readFileSync(new URL("../public/tracks/demo.musicxml", import.meta.url), "utf8");
const parsed = parseMusicXML(xml, LiteDOMParser, { trackId: "ecology-demo" });
const centerPc = 11;
const field = [11, 1, 3, 5, 6, 8, 10];

test("pitch ecology produces normalized 12-degree onset and duration distributions", () => {
  const block = extractPitchEcology(parsed.eventsV1, { centerPc, referenceField: field });
  assert.equal(block.relativeOnsetDistribution.length, 12);
  assert.equal(block.relativeDurationDistribution.length, 12);
  assert.ok(Math.abs(block.relativeOnsetDistribution.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.ok(Math.abs(block.relativeDurationDistribution.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.equal(block.labels[1], "b2");
  assert.equal(block.labels[7], "5");
  assert.ok(block.entropy >= 0 && block.entropy <= 1);
  assert.ok(block.diatonicConcentration >= 0 && block.diatonicConcentration <= 1);
});

test("pitch ecology is invariant when events, center, and reference field transpose together", () => {
  const baseline = extractPitchEcology(parsed.eventsV1, { centerPc, referenceField: field });
  for (const shift of [-11, -6, -1, 1, 5, 11]) {
    const shiftedEvents = transposeEvents(parsed.eventsV1, shift);
    const shifted = extractPitchEcology(shiftedEvents, {
      centerPc: transposePitchClass(centerPc, shift),
      referenceField: transposePitchSet(field, shift)
    });
    assert.deepEqual(shifted.relativeOnsetDistribution, baseline.relativeOnsetDistribution);
    assert.deepEqual(shifted.relativeDurationDistribution, baseline.relativeDurationDistribution);
    assert.equal(shifted.tonicShare, baseline.tonicShare);
    assert.equal(shifted.fifthShare, baseline.fifthShare);
    assert.ok(Math.abs(shifted.diatonicConcentration - baseline.diatonicConcentration) < 1e-12);
  }
});

test("weighted windows can feed the same pitch ecology extractor", () => {
  const events = parsed.eventsV1.slice(0, 3);
  const block = extractPitchEcology(events, { centerPc, weights: [1, 0, 0], topCount: 1 });
  assert.equal(block.topDegrees.length, 1);
  assert.equal(block.relativeOnsetDistribution[(events[0].pitchClass - centerPc + 12) % 12], 1);
});

test("degree label contract is chromatic and key-independent", () => {
  assert.deepEqual([...RELATIVE_CHROMATIC_DEGREE_LABELS], [
    "1", "b2", "2", "b3", "3", "4", "#4/b5", "5", "b6", "6", "b7", "7"
  ]);
});
