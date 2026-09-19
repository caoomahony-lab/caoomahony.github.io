import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { parseMusicXML } from "../src/music/musicxml.js";
import { serializeParsedScoreToMusicXML } from "../src/music/musicxml-export.js";

const source=fs.readFileSync(new URL("../public/tracks/demo.musicxml",import.meta.url),"utf8");

test("MusicXML exporter round-trips demo pitch and score timing", () => {
  const parsed=parseMusicXML(source,LiteDOMParser,{trackId:"source"});
  const xml=serializeParsedScoreToMusicXML(parsed,{title:"Round Trip",sourceFormat:"musicxml",evidenceClass:"measured-from-score"});
  const round=parseMusicXML(xml,LiteDOMParser,{trackId:"roundtrip"});
  assert.equal(round.notes.length,parsed.notes.length);
  assert.deepEqual(round.notes.map(n=>n.midi),parsed.notes.map(n=>n.midi));
  assert.deepEqual(round.notes.map(n=>n.qBeat),parsed.notes.map(n=>n.qBeat));
  assert.deepEqual(round.notes.map(n=>n.durationQ),parsed.notes.map(n=>n.durationQ));
  assert.match(xml,/harmonic-savant-evidence/);
  assert.match(xml,/musicxml-export-v1/);
});

test("MusicXML parser exposes measure and meter metadata for deterministic export", () => {
  const parsed=parseMusicXML(source,LiteDOMParser);
  assert.ok(parsed.measureMap.length>0);
  assert.ok(parsed.measureMap.every(m=>m.endQ>m.startQ));
  assert.ok(Array.isArray(parsed.timeSignatureEvents));
});
