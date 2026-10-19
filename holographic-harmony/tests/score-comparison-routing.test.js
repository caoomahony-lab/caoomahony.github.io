import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { HolographicHarmonyApp } from "../src/app/app.js";
import { ScoreComparisonPanel } from "../src/app/score-comparison-panel.js";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { processScoreComparisonRequest } from "../src/similarity/score-comparison-service.js";

const bytes = fs.readFileSync(new URL("../public/tracks/chromatic-voice-leading.musicxml", import.meta.url));
const file = { name: "score.musicxml", type: "application/xml", text: async () => bytes.toString("utf8"), arrayBuffer: async () => Uint8Array.from(bytes).buffer };
function appStub() {
  const received = [];
  const app = { received, generation: 0, root: { dispatchEvent: event => received.push(event) },
    beginLoad() { return ++this.generation; }, releaseLocalObjectUrl() {}, ensureLocalOption() {}, setScoreExport() {}, clearScoreExport() {}, renderAt() {},
    publishScoreFingerprint: HolographicHarmonyApp.prototype.publishScoreFingerprint,
    commitLoadSession: HolographicHarmonyApp.prototype.commitLoadSession,
    recoverLoadFailure: HolographicHarmonyApp.prototype.recoverLoadFailure,
    audio: { removeAttribute() {}, load() {} }, sourceNote: {}, status: {}, fieldEl: {}, modeBadge: {}, playButton: {} };
  return app;
}

test("a local MusicXML file reaches score comparison with canonical events and its actual source hash", async () => {
  const originalParser = globalThis.DOMParser; globalThis.DOMParser = LiteDOMParser;
  try {
    const app = appStub(); await HolographicHarmonyApp.prototype.loadLocalScore.call(app, file);
    assert.equal(app.status.textContent, "READY");
    const detail = app.received.find(event => event.type === "harmonic-savant:score-ready").detail;
    assert.equal(detail.events.length, 24); assert.equal(detail.sourceId, "sha256:" + createHash("sha256").update(bytes).digest("hex"));
    const result = processScoreComparisonRequest({ type: "derive", events: detail.events, options: { sourceId: detail.sourceId, sourceFormat: detail.sourceFormat } });
    assert.equal(result.counts.regions, 8);
  } finally { globalThis.DOMParser = originalParser; }
});

test("a source switch during hashing never publishes a stale score fingerprint", async () => {
  const originalParser = globalThis.DOMParser; globalThis.DOMParser = LiteDOMParser;
  try {
    const app = appStub();
    const switched = { ...file, arrayBuffer: async () => { app.generation++; return file.arrayBuffer(); } };
    await HolographicHarmonyApp.prototype.loadLocalScore.call(app, switched);
    assert.equal(app.received.length, 0);
    assert.equal(app.currentTrack, undefined);
    assert.equal(app.notes, undefined);
  } finally { globalThis.DOMParser = originalParser; }
});

test("unsupported file selection keeps the current song and its ready state consistent", async () => {
  const track = { id: "playing", title: "Current song" };
  const app = { currentTrack: track, sourceNote: {}, status: { textContent: "READY" }, ensureLocalOption() { throw new Error("Unsupported files must not replace the selected song"); } };
  await HolographicHarmonyApp.prototype.loadLocalFile.call(app, { name: "notes.txt" });
  assert.equal(app.currentTrack, track); assert.equal(app.status.textContent, "READY");
  assert.match(app.sourceNote.textContent, /Unsupported local file.*current piece remains loaded/);
});

test("failed browser storage is not reported as a successful save", () => {
  const app = { current: { title: "score", scoreDescriptor: { sourceId: "same" } }, corpus: [], status: {},
    storage: { setItem() { throw new Error("quota exceeded"); } }, renderCurrent() { throw new Error("must not render a successful save"); } };
  ScoreComparisonPanel.prototype.saveCurrent.call(app);
  assert.deepEqual(app.corpus, []); assert.match(app.status.textContent, /Could not save locally/);
});

test("score records with equal titles keep distinct source identities in local storage", () => {
  const data = new Map();
  const app = { current: { title: "same.musicxml", scoreDescriptor: { sourceId: "first" } }, corpus: [], status: {},
    storage: { setItem(key, value) { data.set(key, value); } }, renderCurrent() {}, renderComparisons() {} };
  ScoreComparisonPanel.prototype.saveCurrent.call(app);
  app.current = { title: "same.musicxml", scoreDescriptor: { sourceId: "second" } };
  ScoreComparisonPanel.prototype.saveCurrent.call(app);
  assert.equal(app.corpus.length, 2); assert.notEqual(app.corpus[0].id, app.corpus[1].id);
});
