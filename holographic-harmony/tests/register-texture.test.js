import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { parseMusicXML } from "../src/music/musicxml.js";
import { transposeEvents } from "../src/theory/transposition.js";
import { extractRegisterTexture } from "../src/fingerprint/blocks/register-texture.js";

const xml = fs.readFileSync(new URL("../public/tracks/demo.musicxml", import.meta.url), "utf8");
const parsed = parseMusicXML(xml, LiteDOMParser, { trackId: "register-demo" });

test("register texture measures span, separation, cardinality, and density", () => {
  const events = [
    { onsetSec: 0, endSec: 4, midi: 36 },
    { onsetSec: 0, endSec: 2, midi: 60 },
    { onsetSec: 2, endSec: 4, midi: 67 }
  ];
  const block = extractRegisterTexture(events);
  assert.equal(block.totalPitchSpan, 31);
  assert.equal(block.minMidi, 36);
  assert.equal(block.maxMidi, 67);
  assert.equal(block.meanSimultaneity, 2);
  assert.equal(block.sparseTextureShare, 1);
  assert.equal(block.denseTextureShare, 0);
  assert.ok(block.meanBassTopSeparation > 0);
});

test("register-shape metrics survive transposition while absolute register shifts", () => {
  const baseline = extractRegisterTexture(parsed.eventsV1);
  const shift = 5;
  const shifted = extractRegisterTexture(transposeEvents(parsed.eventsV1, shift));
  assert.equal(shifted.totalPitchSpan, baseline.totalPitchSpan);
  assert.ok(Math.abs(shifted.meanBassTopSeparation - baseline.meanBassTopSeparation) < 1e-12);
  assert.deepEqual(shifted.simultaneityCardinality, baseline.simultaneityCardinality);
  assert.ok(Math.abs(shifted.meanSimultaneity - baseline.meanSimultaneity) < 1e-12);
  assert.equal(shifted.attackDensityPerSecond, baseline.attackDensityPerSecond);
  assert.equal(shifted.medianMidi, baseline.medianMidi + shift);
  assert.ok(Math.abs(shifted.bassTopIndependenceRate - baseline.bassTopIndependenceRate) < 1e-12);
});

test("register texture rates and normalized climax position are bounded", () => {
  const block = extractRegisterTexture(parsed.eventsV1);
  assert.ok(block.expansionTransitionRate >= 0 && block.expansionTransitionRate <= 1);
  assert.ok(block.contractionTransitionRate >= 0 && block.contractionTransitionRate <= 1);
  assert.ok(block.sparseTextureShare >= 0 && block.sparseTextureShare <= 1);
  assert.ok(block.denseTextureShare >= 0 && block.denseTextureShare <= 1);
  assert.ok(block.registralClimaxPosition >= 0 && block.registralClimaxPosition <= 1);
  assert.ok(block.bassTopIndependenceRate >= 0 && block.bassTopIndependenceRate <= 1);
});
