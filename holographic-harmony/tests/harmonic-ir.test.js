import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createNoteEventV1 } from "../src/model/events.js";
import { createHarmonicStateV1, validateHarmonicStateV1 } from "../src/model/harmonic-state.js";
import { buildScoreHIR, validateScoreHIR, harmonicStateAt, serializeScoreHIR, parseScoreHIR, transposeScoreHIR } from "../src/model/harmonic-ir.js";
import { extractHarmonicFingerprintFromHIR, validateHIRFingerprint } from "../src/fingerprint/hir-extract.js";
import { extractHarmonicFingerprintV1 } from "../src/fingerprint/extract.js";
import { parseMusicXML } from "../src/music/musicxml.js";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { transposeEvents } from "../src/theory/transposition.js";
import { deriveScoreComparison, deriveScoreComparisonFromHIR, compareScoreComparisons, SCORE_COMPONENTS } from "../src/similarity/score-comparison.js";
import { processScoreComparisonRequest } from "../src/similarity/score-comparison-service.js";
import { ScoreComparisonPanel } from "../src/app/score-comparison-panel.js";
import { CollectionAwareHolographicHarmonyApp } from "../src/app/collection-aware-app.js";

const note = (midi, onsetSec, durationSec, i, extra = {}) => createNoteEventV1({ trackId: "hir-fixture", source: "manual",
  sourceOrdinal: i, midi, octave: Math.floor(midi / 12) - 1, onsetSec, durationSec, spelling: "source spelling", ...extra });
const fixture = parseMusicXML(fs.readFileSync(new URL("../public/tracks/chromatic-voice-leading.musicxml", import.meta.url), "utf8"), LiteDOMParser).eventsV1;
const build = (events = fixture, options = {}) => buildScoreHIR(events, { sourceId: "test-source", ...options });
function near(a, b, path = "value") {
  if (typeof a === "number") { assert.ok(Math.abs(a - b) < 1e-10, `${path}: ${a} vs ${b}`); return; }
  if (a == null || typeof a !== "object") { assert.equal(b, a, path); return; }
  assert.deepEqual(Object.keys(b).sort(), Object.keys(a).sort(), path);
  for (const key of Object.keys(a)) near(a[key], b[key], `${path}.${key}`);
}

test("state windows clip duration, retain exact attacks and exclude tied continuations", () => {
  const events = [note(60, 0, 3, 0), note(64, 1, 2, 1), note(67, 2, 1, 2, { tieStop: true }), note(61, 1.5, 0, 3, { grace: true })];
  const state = createHarmonicStateV1(events, { sourceId: "clip", time: 1.5, windowStart: 1, windowEnd: 2, activeField: [0, 4] });
  assert.equal(validateHarmonicStateV1(state), true);
  assert.equal(state.measured.durationWeights[0], 1); assert.equal(state.measured.durationWeights[4], 1);
  assert.equal(state.measured.durationWeights[7], 0); assert.equal(state.measured.onsetCounts[1], 1);
  assert.equal(state.measured.onsetCounts[0], 0); assert.equal(state.measured.onsetCounts[7], 0);
  assert.equal(state.measured.bassPitchClassActivity[0], 1); assert.equal(state.measured.topPitchClassActivity[4], 1);
  assert.equal(state.measured.intervalClassHistogram[3], 1); assert.equal(state.measured.attackDensity, 2);
  assert.equal(state.measured.chromaticDensity, 0);
});

test("HIR retains immutable source identities, spelling, and exact relative degree records", () => {
  const before = JSON.stringify(fixture), hir = build();
  assert.equal(validateScoreHIR(hir), true); assert.equal(JSON.stringify(hir.events), before);
  assert.equal(Object.isFrozen(hir.events[0]), true); assert.equal(Object.isFrozen(hir.harmonicWindows[0].state.inferred), true);
  assert.ok(hir.candidateCenters.length > 1);
  for (const relative of hir.relativeEvents) assert.equal(relative.degree.semitones, relative.relativePitchClass);
  const corrupt = { ...fixture[0], octave: fixture[0].octave + 1 };
  assert.throws(() => build([corrupt]), /consistent/); assert.throws(() => build([fixture[0], fixture[0]]), /unique|consistent/);
  assert.throws(() => build(fixture, { sourceId: "sha256:invalid" }), /SHA-256/);
});

test("live state uses exact-time admissions during rests, reverse seeks, and changed fields", () => {
  const events = [note(62, 3, 1, 0), note(61, 0, 1, 1), note(64, 3, 1, 2)];
  const hir = build(events, { referenceCenterPc: 0, referenceField: [0, 4, 7] });
  assert.deepEqual(harmonicStateAt(hir, .5).holographic.admissions.map(x => x.pc), [1]);
  const silence = harmonicStateAt(hir, 2);
  assert.deepEqual(silence.measured.pitchClasses, []); assert.deepEqual(silence.holographic.admissions.map(x => x.pc), [1]);
  assert.deepEqual(harmonicStateAt(hir, 4).measured.pitchClasses, []);
  assert.deepEqual(harmonicStateAt(hir, 3.5).holographic.admissions.map(x => x.pc), [1, 2]);
  assert.deepEqual(harmonicStateAt(hir, .5).holographic.admissions.map(x => x.pc), [1]);
  assert.deepEqual(harmonicStateAt(hir, .5, { activeField: [1] }).holographic.admissions, []);
  const live = harmonicStateAt(hir, 3.5, { activeField: [1, 2], activity: { raw: Array(12).fill(0).map((_, pc) => pc === 4 ? 2 : 0) } });
  assert.equal(live.measured.activityBasis, "live-decayed-note-kernel"); assert.equal(live.holographic.shadowActivation, 1);
  assert.equal(live.measured.chromaticDensity, .5); assert.equal(validateHarmonicStateV1(live), true);
});

test("zero-duration events remain in source records and window attacks without sounding mass", () => {
  const hir = build([note(60, 0, 2, 0), note(61, .5, 0, 1, { grace: true })], { referenceCenterPc: 0 });
  assert.equal(hir.events.length, 2); assert.equal(hir.harmonicWindows[0].state.measured.onsetCounts[1], 1);
  assert.equal(hir.globalState.measured.durationWeights[1], 0);
});

test("canonical HIR JSON round trips and rejects unsupported versions or inconsistent derived records", () => {
  const hir = build(); const serialized = serializeScoreHIR(hir);
  assert.equal(serializeScoreHIR(parseScoreHIR(serialized)), serialized);
  for (const mutate of [value => value.schemaVersion = "hir-future", value => value.relativeEvents[0].relativePitchClass = 9,
    value => value.globalState.deterministic.activeField = [0], value => value.harmonicWindows[0].state.measured.durationWeights[0] += 1]) {
    const value = JSON.parse(serialized); mutate(value); assert.throws(() => parseScoreHIR(JSON.stringify(value)), /HIR/);
  }
});

test("HIR imports allow bounded cross-engine rounding while returning rebuilt derived evidence", () => {
  const hir = build(), exported = JSON.parse(serializeScoreHIR(hir));
  for (const candidate of exported.candidateCenters) {
    for (const scale of candidate.scaleCandidates) scale.relativeWeight += Number.EPSILON / 4;
  }
  exported.harmonicWindows[0].state.inferred.scaleCandidates[0].relativeWeight += Number.EPSILON / 4;
  assert.equal(serializeScoreHIR(parseScoreHIR(JSON.stringify(exported))), serializeScoreHIR(hir));
});

test("HIR rebuild validation rejects larger numerical changes, integer corruption and extra or missing records", () => {
  const text = serializeScoreHIR(build());
  for (const mutate of [value => value.candidateCenters[0].scaleCandidates[0].relativeWeight += 1e-8,
    value => value.globalState.measured.onsetCounts[0] += Number.EPSILON * 4,
    value => value.globalState.measured.extra = 0,
    value => delete value.candidateCenters[0].scaleCandidates[0].relativeWeight,
    value => value.provenance.configuration.extra = "unexpected",
    value => value.source.extra = "unexpected",
    value => value.events[0].pitchClass = (value.events[0].pitchClass + 1) % 12]) {
    const changed = JSON.parse(text); mutate(changed);
    assert.throws(() => parseScoreHIR(JSON.stringify(changed)), /HIR/);
  }
});

test("expanded extraction preserves all four foundation blocks and explicitly omits unimplemented evidence", () => {
  const hir = build(), expanded = extractHarmonicFingerprintFromHIR(hir);
  const foundation = extractHarmonicFingerprintV1(hir.events, { sourceId: hir.source.id, centerPc: hir.selectedReferenceCenter.pc, referenceField: hir.referenceField });
  assert.equal(validateHIRFingerprint(expanded), true);
  for (const key of foundation.capabilities.implementedBlocks) assert.deepEqual(expanded.normalized[key], foundation.normalized[key]);
  assert.equal(expanded.capabilities.implementedBlocks.length, 9); assert.equal(expanded.capabilities.pendingBlocks.length, 4);
  assert.equal(expanded.normalized.modalProfile.centerChangeRate, null); assert.equal(expanded.normalized.chromaticStrategy.centerChangePrecedenceRate, null);
  assert.equal(expanded.inferenceQuality.weightsAreProbabilities, false);
  for (const key of expanded.capabilities.pendingBlocks) assert.equal(expanded.normalized[key], null);
});

test("nine normalized blocks and normalization anchors covary across all twelve global transpositions", () => {
  const ambiguous = [60, 63, 66, 69].map((midi, i) => note(midi, 0, 1, i));
  for (const events of [fixture, ambiguous]) {
    const hir = build(events), a = extractHarmonicFingerprintFromHIR(hir);
    for (let shift = 0; shift < 12; shift++) {
      const inferred = build(transposeEvents(events, shift));
      assert.equal(inferred.selectedReferenceCenter.pc, (hir.selectedReferenceCenter.pc + shift) % 12);
      near(a.normalized, extractHarmonicFingerprintFromHIR(inferred).normalized, `inferred T${shift}`);
      const transformed = transposeScoreHIR(hir, shift);
      near(a.normalized, extractHarmonicFingerprintFromHIR(transformed).normalized, `declared T${shift}`);
      assert.equal(transformed.events[0].sourceSpelling, hir.events[0].spelling);
    }
    const back = transposeScoreHIR(transposeScoreHIR(hir, 7), -7);
    assert.deepEqual(back.events.map(x => x.midi), hir.events.map(x => x.midi));
    assert.equal(back.provenance.transformations.length, 2);
  }
});

test("HIR projection exactly preserves all eight legacy comparison metrics and tempo behavior", () => {
  for (const factor of [1, .25, 2]) {
    const events = fixture.map(event => ({ ...event, onsetSec: event.onsetSec * factor, durationSec: event.durationSec * factor, endSec: event.endSec * factor }));
    const fromHIR = deriveScoreComparisonFromHIR(build(events)), legacy = deriveScoreComparison(events, { sourceId: "test-source" });
    assert.deepEqual(fromHIR, legacy);
    const comparison = compareScoreComparisons(deriveScoreComparisonFromHIR(build()), fromHIR);
    for (const key of SCORE_COMPONENTS.map(x => x.key)) if (comparison.components[key] != null) assert.ok(comparison.components[key] < 1e-12, key);
  }
});

test("worker analysis fails back visibly to compatible legacy comparisons when HIR evidence is inconsistent", () => {
  const analyzed = processScoreComparisonRequest({ type: "analyze", events: fixture, options: { sourceId: "test-source" } });
  assert.equal(analyzed.advancedError, null); assert.equal(validateScoreHIR(analyzed.hir), true);
  const events = fixture.map(event => ({ ...event, octave: event.octave + 1 }));
  const fallback = processScoreComparisonRequest({ type: "analyze", events, options: { sourceId: "test-source" } });
  assert.equal(fallback.hir, null); assert.match(fallback.advancedError, /consistent/); assert.equal(fallback.scoreDescriptor.version, "score-comparison-v1");
});

test("a stale worker analysis cannot attach to a new source and saved descriptors exclude source notes", async () => {
  const analysis = processScoreComparisonRequest({ type: "analyze", events: fixture, options: { sourceId: "test-source" } });
  let resolve, calls = 0;
  const panel = { root: {}, sourceGeneration: 0, status: {}, request: () => new Promise(r => { resolve = r; }),
    renderCurrent() {}, renderComparisons() {}, onAnalysisReady() { calls++; } };
  const pending = ScoreComparisonPanel.prototype.accept.call(panel, { sourceId: "test-source", events: fixture });
  panel.sourceGeneration++; resolve(analysis); await pending; assert.equal(calls, 0); assert.equal(panel.current, undefined);
  panel.request = async () => analysis;
  await ScoreComparisonPanel.prototype.accept.call(panel, { sourceId: "test-source", events: fixture });
  assert.equal(calls, 1); assert.equal(panel.analysis.hir.source.id, "test-source");
  let saved; Object.assign(panel, { corpus: [], storage: { setItem(key, text) { saved = JSON.parse(text); } } });
  ScoreComparisonPanel.prototype.saveCurrent.call(panel);
  assert.equal(saved[0].scoreDescriptor.version, "score-comparison-v1"); assert.equal(saved[0].analysis, undefined); assert.equal(saved[0].hir, undefined);
  const visualizer = { currentTrack: { id: "other" }, scoreSourceId: "other" };
  assert.equal(CollectionAwareHolographicHarmonyApp.prototype.acceptHarmonicIR.call(visualizer, analysis.hir), false);
});
