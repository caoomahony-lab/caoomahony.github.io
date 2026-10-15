import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createNoteEventV1 } from "../src/model/events.js";
import { parseMusicXML } from "../src/music/musicxml.js";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { transposeEvents } from "../src/theory/transposition.js";
import { deriveScoreComparison, compareScoreComparisons, validateScoreComparison, SCORE_COMPONENTS } from "../src/similarity/score-comparison.js";
import { orderedHarmonyDistance, orderedHarmonyDistanceAtShift } from "../src/similarity/evidence-aware-distance.js";
import { processScoreComparisonRequest } from "../src/similarity/score-comparison-service.js";

const fixture = parseMusicXML(fs.readFileSync(new URL("../public/tracks/chromatic-voice-leading.musicxml", import.meta.url), "utf8"), LiteDOMParser).eventsV1;
const derive = events => deriveScoreComparison(events, { sourceId: "fixture" });
const note = (midi, onsetSec = 0, durationSec = 1, i = 0) => createNoteEventV1({ trackId: "test", sourceOrdinal: i, midi, onsetSec, durationSec, octave: Math.floor(midi / 12) - 1 });
const nearZero = comparison => {
  for (const component of SCORE_COMPONENTS) if (comparison.components[component.key] != null) assert.ok(comparison.components[component.key] < 1e-12, `${component.key}: ${comparison.components[component.key]}`);
};

test("new score comparison preserves provenance, the canonical foundation and every global transposition", () => {
  const a = derive(fixture); assert.equal(validateScoreComparison(a), true);
  assert.equal(a.foundationFingerprint.capabilities.implementedBlocks.length, 4);
  assert.equal(a.provenance.attackTimeBasis, "quarter-beats");
  for (let shift = 0; shift < 12; shift++) {
    const comparison = compareScoreComparisons(a, derive(transposeEvents(fixture, shift)));
    nearZero(comparison); assert.equal(comparison.shiftBToA, (12 - shift) % 12);
  }
});

test("exact score attacks survive fast global tempo scaling without the 90ms grouping flaw", () => {
  const events = [note(60, 0), note(64, .07), note(67, .14), note(62, .21)];
  const a = derive(events); assert.equal(a.counts.attacks, 4);
  for (const factor of [.25, 2, 10]) {
    const scaled = events.map(event => ({ ...event, onsetSec: event.onsetSec * factor, durationSec: event.durationSec * factor, endSec: event.endSec * factor }));
    nearZero(compareScoreComparisons(a, derive(scaled)));
  }
});

test("complete tied chord-candidate cohorts remain equal across all transpositions", () => {
  const a = derive([60, 64, 67, 69].map((midi, i) => note(midi, 0, 1, i)));
  assert.equal(a.counts.ambiguousRegions, 1);
  assert.match(a.candidateSequence[0].family, /major6/); assert.match(a.candidateSequence[0].family, /minor7/);
  for (let shift = 0; shift < 12; shift++) {
    const b = derive(transposeEvents([60, 64, 67, 69].map((midi, i) => note(midi, 0, 1, i)), shift));
    nearZero(compareScoreComparisons(a, b));
  }
});

test("identical pitch inventories with destroyed order retain pitch equality but diverge in whole-score order", () => {
  const a = derive([60, 62, 64, 60, 67, 71, 60].map((midi, i) => note(midi, i, 1, i)));
  const b = derive([60, 67, 71, 60, 62, 64, 60].map((midi, i) => note(midi, i, 1, i)));
  const comparison = compareScoreComparisons(a, b, { rankBy: "pitchContent" });
  assert.equal(comparison.distance, 0); assert.equal(comparison.components.sonorityOrder, 4 / 7);
  assert.equal(comparison.components.verticalIntervals, null);
  assert.match(comparison.explanations.join(" "), /Sonority order differs/);
  assert.equal(compareScoreComparisons(b, a).distance, compareScoreComparisons(a, b).distance);
});

test("unchanged sonority order with changed rhythmic proportions is explained separately", () => {
  const pitches = [60, 62, 67, 64];
  const a = derive(pitches.map((midi, i) => note(midi, i, 1, i)));
  const starts = [0, .5, 2, 3], durations = [.5, 1.5, 1, 1];
  const b = derive(pitches.map((midi, i) => note(midi, starts[i], durations[i], i)));
  const comparison = compareScoreComparisons(a, b);
  assert.equal(comparison.components.sonorityOrder, 0); assert.ok(comparison.components.attackRhythm > 0);
  assert.match(comparison.explanations.join(" "), /rhythmic proportions differ/);
});

test("changed bass with identical pitch-class inventory is visible in a separate measured component", () => {
  const a = derive([60, 64, 67].map((midi, i) => note(midi, 0, 1, i)));
  const b = derive([72, 64, 67].map((midi, i) => note(midi, 0, 1, i)));
  const comparison = compareScoreComparisons(a, b, { rankBy: "pitchContent" });
  assert.equal(comparison.components.pitchContent, 0); assert.equal(comparison.components.bass, 1);
  assert.equal(comparison.components.sonorityOrder, 1);
  assert.equal(comparison.components.attackRhythm, null);
});

test("one global alignment is kept across pitch-dependent components", () => {
  const a = derive(fixture), b = derive(transposeEvents(fixture, 5));
  for (const rankBy of ["sonorityOrder", "candidateOrder", "pitchContent", "bass"]) {
    const comparison = compareScoreComparisons(a, b, { rankBy });
    assert.equal(comparison.shiftBToA, 7); nearZero(comparison);
    assert.deepEqual(comparison.overlays.pitchA, comparison.overlays.pitchB);
  }
});

test("whole-score limits remain unavailable without silently substituting matching openings", () => {
  const a = derive(fixture);
  const sequence = Array.from({ length: 700 }, (_, i) => a.measuredSequence[i % a.measuredSequence.length]);
  const one = { ...a, counts: { ...a.counts, regions: 700 }, measuredSequence: sequence, candidateSequence: sequence };
  const changed = sequence.map((token, i) => i === 699 ? { ...token, family: "0" } : token);
  const two = { ...one, measuredSequence: changed, candidateSequence: changed };
  const comparison = compareScoreComparisons(one, two, { maxCellUpdates: 1000 });
  assert.equal(comparison.order.reason, "COMPUTE_LIMIT"); assert.equal(comparison.distance, null);
  assert.equal(comparison.opening.distance, 0); assert.equal(comparison.opening.regionsA, 64);
});

test("missing and corrupt saved evidence fail closed, with deterministic non-destructive extraction", () => {
  const before = JSON.stringify(fixture), a = derive(fixture);
  assert.deepEqual(a, derive(fixture)); assert.equal(JSON.stringify(fixture), before);
  assert.equal(Object.isFrozen(a.candidateSequence[0]), true);
  assert.equal(validateScoreComparison(JSON.parse(JSON.stringify(a))), true);
  assert.throws(() => derive([]), /Nonempty/);
  assert.throws(() => derive([note(60, 0, 0)]), /no sounding/);
  assert.throws(() => derive([{ ...fixture[0], pitchClass: 0 }]), /consistent/);
  const corrupt = { ...a, distributions: { ...a.distributions, bass: Array(12).fill(1) } };
  assert.equal(validateScoreComparison(corrupt), false);
  assert.throws(() => compareScoreComparisons(a, corrupt), /re-analyze/);
  assert.throws(() => compareScoreComparisons(a, a, { rankBy: "totalPercent" }), /Unknown/);
});

test("fixed-shift edit distance honors the declared alignment and agrees with exact matching", () => {
  const a = [{ rootPc: 0, family: "major" }, { rootPc: 7, family: "major" }];
  const b = [{ rootPc: 5, family: "major" }, { rootPc: 0, family: "major" }];
  assert.equal(orderedHarmonyDistance(a, b).distance, 0);
  assert.equal(orderedHarmonyDistanceAtShift(a, b, 7).distance, 0);
  assert.equal(orderedHarmonyDistanceAtShift(a, b, 0).distance, 1);
});

test("the worker service runs canonical-event extraction through saved-record comparison", () => {
  const current = processScoreComparisonRequest({ type: "derive", events: fixture, options: { sourceId: "current", sourceFormat: "mxl" } });
  const saved = processScoreComparisonRequest({ type: "derive", events: transposeEvents(fixture, 3), options: { sourceId: "saved", sourceFormat: "midi" } });
  const [result] = processScoreComparisonRequest({ type: "compare", current, pieces: [{ id: "saved", scoreDescriptor: saved }], options: { rankBy: "sonorityOrder" } });
  assert.equal(result.id, "saved"); assert.equal(result.comparison.distance, 0);
  assert.equal(current.provenance.sourceFormat, "mxl"); assert.equal(saved.provenance.sourceFormat, "midi");
  assert.throws(() => processScoreComparisonRequest({ type: "unknown" }), /Unknown/);
});
