import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { inferAudioHarmonySegments, AUDIO_HARMONY_VERSION } from "../src/inference/audio-harmony.js";

function chromaFor(pcs, background = 0.015) {
  const chroma = Array(12).fill(background);
  for (const [index, pc] of pcs.entries()) chroma[pc] = 1 - index * 0.06;
  return chroma;
}

function frames(blocks, hop = 0.25) {
  const result = [];
  let index = 0;
  for (const block of blocks) {
    for (let i = 0; i < block.count; i += 1) {
      result.push({ time: index * hop, chroma: chromaFor(block.pcs) });
      index += 1;
    }
  }
  return result;
}

test("audio harmonic segmentation recovers stable C-major then G-major regions", () => {
  const hop = 0.25;
  const input = frames([
    { pcs: [0, 4, 7], count: 12 },
    { pcs: [7, 11, 2], count: 12 }
  ], hop);
  const result = inferAudioHarmonySegments(input, hop, { minSegmentSeconds: 0.5 });
  assert.equal(result.version, AUDIO_HARMONY_VERSION);
  assert.equal(result.evidenceClass, "inferred-from-audio");
  assert.ok(result.segmentCount >= 2);
  assert.equal(result.segments[0].symbol, "C");
  assert.equal(result.segments.at(-1).symbol, "G");
  assert.ok(result.segments.every((segment) => segment.candidates.length >= 2));
  assert.ok(result.regionCount <= result.segmentCount);
  assert.equal(result.harmonicRegions.microSegments[0], result.segments[0]);
  assert.deepEqual(
    result.regions.flatMap((region) => region.constituentMicroSegmentIndices).sort((a, b) => a - b),
    result.segments.map((segment) => segment.index)
  );
});

test("brief chromatic disturbance does not manufacture a stable chord segment", () => {
  const hop = 0.2;
  const input = frames([
    { pcs: [0, 4, 7], count: 10 },
    { pcs: [1, 6, 9], count: 1 },
    { pcs: [0, 4, 7], count: 10 }
  ], hop);
  const result = inferAudioHarmonySegments(input, hop, { minSegmentSeconds: 0.8 });
  assert.equal(result.segmentCount, 1);
  assert.equal(result.segments[0].symbol, "C");
});

test("audio chord layer preserves ambiguity and does not invent bass evidence", () => {
  const hop = 0.25;
  const input = frames([{ pcs: [0, 4, 7], count: 8 }], hop);
  const result = inferAudioHarmonySegments(input, hop);
  const segment = result.segments[0];
  assert.equal(segment.bassPc, null);
  assert.match(segment.bassEvidence, /unavailable/);
  assert.equal(segment.evidenceClass, "inferred-from-audio");
  assert.ok(segment.candidates[0].relativeWeight > 0);
  assert.ok(segment.ambiguity >= 0 && segment.ambiguity <= 1);
  assert.match(result.note, /inferred/i);
});

test("browser surface includes the audio harmonic timeline and stylesheet", () => {
  const appSource = fs.readFileSync(new URL("../src/app/collection-aware-app.js", import.meta.url), "utf8");
  const indexSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(appSource, /AUDIO HARMONIC TIMELINE/);
  assert.match(appSource, /inferAudioHarmonySegments/);
  assert.match(appSource, /relative weights, not probabilities/);
  assert.match(indexSource, /audio-harmony\.css/);
});
