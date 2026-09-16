import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { parseMusicXML } from "../src/music/musicxml.js";
import {
  NOTE_EVENT_SCHEMA_VERSION,
  canonicalizeNoteEvents,
  createNoteEventV1,
  validateNoteEventV1
} from "../src/model/events.js";

const xml = fs.readFileSync(new URL("../public/tracks/demo.musicxml", import.meta.url), "utf8");

test("MusicXML exposes a versioned canonical NoteEventV1 stream without removing legacy notes", () => {
  const parsed = parseMusicXML(xml, LiteDOMParser, { trackId: "paper-demo" });
  assert.equal(parsed.notes.length, 32);
  assert.equal(parsed.eventsV1.length, parsed.notes.length);
  assert.equal(parsed.eventSchemaVersion, NOTE_EVENT_SCHEMA_VERSION);

  const first = parsed.eventsV1[0];
  assert.equal(first.schemaVersion, 1);
  assert.equal(first.eventType, "note");
  assert.equal(first.trackId, "paper-demo");
  assert.equal(first.source, "musicxml");
  assert.equal(first.pitchClass, 11);
  assert.equal(first.midi, parsed.notes[0].midi);
  assert.equal(first.spelling, parsed.notes[0].spelling);
  assert.equal(first.onsetSec, parsed.notes[0].onset);
  assert.equal(first.durationSec, parsed.notes[0].duration);
  assert.equal(first.endSec, first.onsetSec + first.durationSec);
  assert.equal(first.scoreOnsetQuarterBeat, parsed.notes[0].qBeat);
  assert.equal(first.scoreDurationQuarterBeats, parsed.notes[0].durationQ);
});

test("canonical IDs are deterministic for the same track and distinct across tracks", () => {
  const a = parseMusicXML(xml, LiteDOMParser, { trackId: "demo-a" });
  const b = parseMusicXML(xml, LiteDOMParser, { trackId: "demo-a" });
  const c = parseMusicXML(xml, LiteDOMParser, { trackId: "demo-b" });

  assert.deepEqual(a.eventsV1.map((event) => event.id), b.eventsV1.map((event) => event.id));
  assert.notEqual(a.eventsV1[0].id, c.eventsV1[0].id);
  assert.equal(new Set(a.eventsV1.map((event) => event.id)).size, a.eventsV1.length);
});

test("all canonical demo events satisfy timing, pitch, spelling, and immutability invariants", () => {
  const parsed = parseMusicXML(xml, LiteDOMParser, { trackId: "invariants" });
  for (const event of parsed.eventsV1) {
    assert.equal(validateNoteEventV1(event), true);
    assert.ok(Number.isFinite(event.onsetSec));
    assert.ok(Number.isFinite(event.durationSec));
    assert.ok(event.durationSec >= 0);
    assert.ok(event.pitchClass >= 0 && event.pitchClass <= 11);
    assert.equal(typeof event.spelling, "string");
    assert.equal(Object.isFrozen(event), true);
  }
  assert.equal(Object.isFrozen(parsed.eventsV1), true);
});

test("canonicalization is additive and does not mutate legacy parser events", () => {
  const parsed = parseMusicXML(xml, LiteDOMParser, { trackId: "legacy-source" });
  const before = JSON.stringify(parsed.notes);
  const derived = canonicalizeNoteEvents(parsed.notes, { trackId: "derived-copy" });
  assert.equal(JSON.stringify(parsed.notes), before);
  assert.equal(derived.length, parsed.notes.length);
  assert.notEqual(derived[0].id, parsed.eventsV1[0].id);
});

test("NoteEventV1 constructor rejects invalid timing and normalizes pitch classes", () => {
  assert.throws(() => createNoteEventV1({
    trackId: "bad",
    sourceOrdinal: 0,
    onsetSec: Number.NaN,
    durationSec: 1,
    midi: 60,
    pitchClass: 0,
    octave: 4,
    source: "manual"
  }), /onsetSec/);

  const event = createNoteEventV1({
    trackId: "normalize",
    sourceOrdinal: 0,
    onsetSec: 0,
    durationSec: 1,
    midi: 71,
    pitchClass: -1,
    octave: 4,
    spelling: "B",
    source: "manual"
  });
  assert.equal(event.pitchClass, 11);
});
