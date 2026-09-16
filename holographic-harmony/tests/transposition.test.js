import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { parseMusicXML } from "../src/music/musicxml.js";
import {
  normalizeToCenter,
  rotateHistogram,
  transposeEvents,
  transposePitchClass,
  transposePitchSet
} from "../src/theory/transposition.js";

const xml = fs.readFileSync(new URL("../public/tracks/demo.musicxml", import.meta.url), "utf8");

function onsetHistogram(events) {
  const bins = Array(12).fill(0);
  for (const event of events) bins[event.pitchClass] += 1;
  return bins;
}

test("pitch classes and pitch sets transpose modulo 12", () => {
  assert.equal(transposePitchClass(11, 2), 1);
  assert.equal(transposePitchClass(0, -1), 11);
  assert.deepEqual([...transposePitchSet([11, 1, 3, 5, 6, 8, 10], 1)], [0, 2, 4, 6, 7, 9, 11]);
});

test("histogram rotation follows pitch transposition and center normalization", () => {
  const histogram = [1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0];
  const rotated = rotateHistogram(histogram, 1);
  assert.deepEqual([...rotated], [0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6]);

  const center = 6;
  const shiftedCenter = transposePitchClass(center, 5);
  assert.deepEqual(
    [...normalizeToCenter(histogram, center)],
    [...normalizeToCenter(rotateHistogram(histogram, 5), shiftedCenter)]
  );
});

test("event transposition is immutable, reversible in pitch coordinates, and timing-preserving", () => {
  const parsed = parseMusicXML(xml, LiteDOMParser, { trackId: "demo-transpose" });
  const original = parsed.eventsV1;
  const before = JSON.stringify(original);
  const up = transposeEvents(original, 6);
  const roundTrip = transposeEvents(up, -6);

  assert.equal(JSON.stringify(original), before);
  assert.notEqual(up, original);
  assert.notEqual(up[0], original[0]);
  assert.equal(Object.isFrozen(up), true);
  assert.equal(Object.isFrozen(up[0]), true);

  for (let i = 0; i < original.length; i += 1) {
    assert.equal(up[i].midi, original[i].midi + 6);
    assert.equal(up[i].pitchClass, transposePitchClass(original[i].pitchClass, 6));
    assert.equal(up[i].onsetSec, original[i].onsetSec);
    assert.equal(up[i].durationSec, original[i].durationSec);
    assert.equal(roundTrip[i].midi, original[i].midi);
    assert.equal(roundTrip[i].pitchClass, original[i].pitchClass);
  }
});

test("normalized pitch ecology is invariant under equal event and center transposition", () => {
  const parsed = parseMusicXML(xml, LiteDOMParser, { trackId: "demo-invariance" });
  const originalHistogram = onsetHistogram(parsed.eventsV1);
  const centerPc = 11;
  const shift = 6;
  const shifted = transposeEvents(parsed.eventsV1, shift);
  const shiftedHistogram = onsetHistogram(shifted);

  assert.deepEqual(shiftedHistogram, [...rotateHistogram(originalHistogram, shift)]);
  assert.deepEqual(
    [...normalizeToCenter(originalHistogram, centerPc)],
    [...normalizeToCenter(shiftedHistogram, transposePitchClass(centerPc, shift))]
  );
});

test("event transposition rejects out-of-range MIDI rather than silently clipping", () => {
  assert.throws(() => transposeEvents([{ id: "n", midi: 126, pitchClass: 6, octave: 9 }], 2), /outside 0\.\.127/);
});
