import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseMusicXML } from "../src/music/musicxml.js";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { createNoteEventV1 } from "../src/model/events.js";
import { transposeEvents } from "../src/theory/transposition.js";
import { deriveScoreSimilarityAudit, compareScoreSimilarityAudits } from "../src/validation/score-similarity-audit.js";

const events = parseMusicXML(fs.readFileSync(new URL("../public/tracks/chromatic-voice-leading.musicxml", import.meta.url), "utf8"), LiteDOMParser).eventsV1;
const derive = (notes, sourceId = "fixture") => deriveScoreSimilarityAudit(notes, { sourceId });

test("symbolic comparison retains measured provenance and withholds audio profile", () => {
  const result = derive(events);
  assert.equal(result.counts.notes, 24);
  assert.equal(result.counts.sonorityRegions, 8);
  assert.equal(result.auditDescriptor.evidenceClass, "measured-score-notes-with-inferred-chords");
  assert.equal(result.auditDescriptor.availability.profile, false);
  assert.deepEqual(result.provenance.formats, ["musicxml"]);
});

test("measured order preserves the entire pitch-class set and sounding bass", () => {
  const result = compareScoreSimilarityAudits(derive(events), derive(transposeEvents(events, 5), "transposed"));
  assert.equal(result.measuredOrder.distance, 0);
  assert.equal(result.measuredOrder.shiftBToA, 7);
  const changed = events.map((event, i) => i === 0 ? { ...event, midi: event.midi + 1, pitchClass: (event.pitchClass + 1) % 12 } : event);
  assert.ok(compareScoreSimilarityAudits(derive(events), derive(changed)).measuredOrder.distance > 0);
});

test("measured order distinguishes a changed bass even with the same pitch classes", () => {
  const a = [60, 64, 67].map((midi, i) => createNoteEventV1({ trackId: "a", sourceOrdinal: i, onsetSec: 0, durationSec: 1, midi, octave: Math.floor(midi / 12) - 1 }));
  const b = [72, 64, 67].map((midi, i) => createNoteEventV1({ trackId: "b", sourceOrdinal: i, onsetSec: 0, durationSec: 1, midi, octave: Math.floor(midi / 12) - 1 }));
  assert.equal(compareScoreSimilarityAudits(derive(a), derive(b)).measuredOrder.distance, 1);
});

test("reordering score passages changes measured order without changing note inventory", () => {
  const order = [0, 2, 1, 3, 4, 5, 6, 7];
  const moved = events.map((event) => {
    const block = Math.floor(event.onsetSec / 2), onsetSec = order.indexOf(block) * 2;
    return { ...event, onsetSec, endSec: onsetSec + event.durationSec };
  });
  assert.ok(compareScoreSimilarityAudits(derive(events), derive(moved)).measuredOrder.distance > 0);
});

test("pitch-set order is stable when tied chord interpretations change under transposition", () => {
  // C6 and Am7 are the same measured set; absolute-root tie breaking changes
  // which interpretation wins after transposition. The measured set is stable.
  const source = [60, 64, 67, 69].map((midi, i) => createNoteEventV1({ trackId: "ambiguous", sourceOrdinal: i, onsetSec: 0, durationSec: 1, midi, octave: Math.floor(midi / 12) - 1 }));
  const result = compareScoreSimilarityAudits(derive(source), derive(transposeEvents(source, 5)));
  assert.equal(result.measuredOrder.distance, 0);
  assert.equal(result.summary.orderedHarmony.distance, 1);
});

test("bounded opening comparisons are labeled separately from the whole score", () => {
  const a = derive(events), b = derive(events);
  const sequence = Array.from({ length: 600 }, (_, i) => ({ ...a.measuredSequence[i % 8] }));
  const changed = sequence.map((token, i) => i === 599 ? { ...token, family: "0" } : token);
  const result = compareScoreSimilarityAudits({ ...a, measuredSequence: sequence }, { ...b, measuredSequence: changed });
  assert.equal(result.measuredOrder.reason, "COMPUTE_LIMIT");
  assert.equal(result.measuredOrder.distance, null);
  assert.equal(result.openingPassage.measuredOrder.distance, 0);
  assert.equal(result.openingPassage.regionLimit, 64);
  assert.equal(result.openingPassage.measuredOrder.regionsA, 64);
});

test("empty symbolic evidence is unavailable and invalid canonical input fails closed", () => {
  const empty = derive([]);
  assert.equal(compareScoreSimilarityAudits(empty, empty).summary.distance, null);
  assert.equal(compareScoreSimilarityAudits(empty, empty).measuredOrder.distance, null);
  assert.throws(() => derive([{ midi: 60 }]), /NoteEventV1/);
  assert.throws(() => derive(events.map((event, i) => i ? event : { ...event, pitchClass: 0 })), /consistent/);
  assert.throws(() => deriveScoreSimilarityAudit(events), /sourceId/);
  assert.throws(() => compareScoreSimilarityAudits(empty, empty, { passageRegionLimit: 0 }), /1\.\.256/);
});

test("score audit leaves source notes unchanged and is deterministic and immutable", () => {
  const before = JSON.stringify(events), a = derive(events), b = derive(events);
  assert.equal(JSON.stringify(events), before);
  assert.deepEqual(a, b);
  assert.equal(Object.isFrozen(a.measuredSequence[0]), true);
  assert.equal(Object.isFrozen(a.auditDescriptor.assumptions), true);
});
