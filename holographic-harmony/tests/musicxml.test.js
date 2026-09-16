import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { parseMusicXML } from "../src/music/musicxml.js";

const xml = fs.readFileSync(new URL("../public/tracks/demo.musicxml", import.meta.url), "utf8");

test("demo MusicXML parses into timed pitch-class events", () => {
  const parsed = parseMusicXML(xml, LiteDOMParser);
  assert.equal(parsed.parts, 1);
  assert.equal(parsed.notes.length, 32);
  assert.equal(parsed.notes[0].pitchClass, 11);
  assert.equal(parsed.notes[3].pitchClass, 5);
  assert.ok(Math.abs(parsed.notes[1].onset - 0.5) < 1e-9);
  assert.ok(Math.abs(parsed.durationSeconds - 16) < 1e-9);
  assert.equal(parsed.tempoEvents[0].bpm, 120);
});

test("shadow admissions in demo begin D-A-E-C-G", () => {
  const parsed = parseMusicXML(xml, LiteDOMParser);
  const shadow = new Set([0, 2, 4, 7, 9]);
  const seen = [];
  for (const note of parsed.notes) {
    if (shadow.has(note.pitchClass) && !seen.includes(note.pitchClass)) seen.push(note.pitchClass);
  }
  assert.deepEqual(seen, [2, 9, 4, 0, 7]);
});
