import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { parseMusicXML } from "../src/music/musicxml.js";
import { transposeEvents, transposePitchClass, transposePitchSet } from "../src/theory/transposition.js";
import { extractHarmonicFingerprintV1 } from "../src/fingerprint/extract.js";
import { parseHarmonicFingerprint, serializeHarmonicFingerprint } from "../src/fingerprint/export.js";
import { validateHarmonicFingerprintV1 } from "../src/fingerprint/schema.js";

const xml = fs.readFileSync(new URL("../public/tracks/demo.musicxml", import.meta.url), "utf8");
const parsed = parseMusicXML(xml, LiteDOMParser, { trackId: "fingerprint-demo" });
const centerPc = 11;
const field = [11, 1, 3, 5, 6, 8, 10];

test("foundation exporter emits a valid versioned fingerprint with pending blocks explicit", () => {
  const fingerprint = extractHarmonicFingerprintV1(parsed.eventsV1, {
    sourceId: "paper-demo",
    centerPc,
    referenceField: field
  });
  assert.equal(validateHarmonicFingerprintV1(fingerprint), true);
  assert.deepEqual(fingerprint.capabilities.implementedBlocks, [
    "pitchEcology", "bassGravity", "intervalSpectrum", "registerTexture"
  ]);
  assert.equal(fingerprint.normalized.chordVocabulary, null);
  assert.equal(fingerprint.normalized.holographic, null);
  assert.equal(Object.isFrozen(fingerprint), true);
});

test("fingerprint JSON serialization is deterministic and round-trippable", () => {
  const fingerprint = extractHarmonicFingerprintV1(parsed.eventsV1, {
    sourceId: "paper-demo",
    centerPc,
    referenceField: field
  });
  const a = serializeHarmonicFingerprint(fingerprint);
  const b = serializeHarmonicFingerprint(fingerprint);
  assert.equal(a, b);
  const parsedFingerprint = parseHarmonicFingerprint(a);
  assert.equal(validateHarmonicFingerprintV1(parsedFingerprint), true);
  assert.deepEqual(parsedFingerprint.normalized.pitchEcology, JSON.parse(a).normalized.pitchEcology);
});

test("normalized foundation fingerprint survives transposition while absolute identity changes", () => {
  const baseline = extractHarmonicFingerprintV1(parsed.eventsV1, {
    sourceId: "baseline",
    centerPc,
    referenceField: field
  });
  const shift = 5;
  const shifted = extractHarmonicFingerprintV1(transposeEvents(parsed.eventsV1, shift), {
    sourceId: "shifted",
    centerPc: transposePitchClass(centerPc, shift),
    referenceField: transposePitchSet(field, shift)
  });
  assert.deepEqual(shifted.normalized, baseline.normalized);
  assert.notEqual(shifted.absolute.centerPc, baseline.absolute.centerPc);
  assert.equal(shifted.absolute.register.medianMidi, baseline.absolute.register.medianMidi + shift);
});

test("fingerprint extraction does not mutate source events", () => {
  const before = JSON.stringify(parsed.eventsV1);
  extractHarmonicFingerprintV1(parsed.eventsV1, { sourceId: "immutability", centerPc, referenceField: field });
  assert.equal(JSON.stringify(parsed.eventsV1), before);
});

test("export rejects unsupported fingerprint shapes", () => {
  assert.throws(() => serializeHarmonicFingerprint({ schemaVersion: "0" }), /Invalid/);
  assert.throws(() => parseHarmonicFingerprint('{"schemaVersion":"0"}'), /invalid/i);
});
