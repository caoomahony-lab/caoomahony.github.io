import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { ScoreComparisonPanel } from "../src/app/score-comparison-panel.js";
import { ReferenceCatalogPanel } from "../src/app/reference-catalog-panel.js";
import { CollectionAwareHolographicHarmonyApp } from "../src/app/collection-aware-app.js";
import { processScoreComparisonRequest } from "../src/similarity/score-comparison-service.js";
import { parseMusicXML } from "../src/music/musicxml.js";
import { LiteDOMParser } from "../src/music/xml-lite.js";

const xml = fs.readFileSync(new URL("../public/tracks/chromatic-voice-leading.musicxml", import.meta.url), "utf8");
const events = parseMusicXML(xml, LiteDOMParser).eventsV1;

test("opening audio invalidates pending score results while retaining the loaded catalog and filters", async () => {
  const analysis = processScoreComparisonRequest({ type: "analyze", events, options: { sourceId: "old-score" } });
  const catalog = { count: 500 }, shards = new Map([["cached-shard", Promise.resolve(new Map())]]);
  const catalogPanel = { current: { title: "Previous score", scoreDescriptor: analysis.scoreDescriptor }, catalog, shards, generation: 0, latestReport: {}, results: { replaceChildren() {} },
    status: {}, exportButton: {}, query: { value: "Bach" }, genre: { value: "classical" }, instrument: { value: "Piano" },
    rankBy: { value: "pitchContent" }, compareButton: {}, loadButton: {},
    clearResults: ReferenceCatalogPanel.prototype.clearResults, updateControls: ReferenceCatalogPanel.prototype.updateControls,
    setCurrent: ReferenceCatalogPanel.prototype.setCurrent };
  let resolve, attached = 0, terminated = 0;
  const panel = { root: { hidden: true }, status: {}, sourceGeneration: 0, comparisonGeneration: 0, pending: new Map(),
    catalogPanel, results: { replaceChildren() {} }, worker: { terminate() { terminated++; } },
    request: () => new Promise(done => { resolve = done; }),
    renderCurrent() { this.catalogPanel.setCurrent(this.current); }, renderComparisons() {},
    onAnalysisReady() { attached++; }, invalidate: ScoreComparisonPanel.prototype.invalidate };
  const pending = ScoreComparisonPanel.prototype.accept.call(panel, { title: "Old score", events, sourceId: "old-score" });
  ScoreComparisonPanel.prototype.setAudioSource.call(panel, { title: "Springtime.wav" });
  resolve(analysis); await pending;
  assert.equal(panel.root.hidden, false); assert.equal(panel.audioTitle, "Springtime.wav");
  assert.equal(panel.current, null); assert.equal(attached, 0); assert.equal(terminated, 1);
  assert.equal(catalogPanel.catalog, catalog); assert.equal(catalogPanel.shards, shards);
  assert.equal(catalogPanel.query.value, "Bach"); assert.equal(catalogPanel.genre.value, "classical");
  assert.equal(catalogPanel.instrument.value, "Piano"); assert.equal(catalogPanel.latestReport, null);
  assert.equal(catalogPanel.compareButton.disabled, true);
  panel.request = async () => analysis;
  await ScoreComparisonPanel.prototype.accept.call(panel, { title: "Matching score", events, sourceId: "old-score", audioReference: true });
  assert.equal(panel.audioTitle, "Springtime.wav"); assert.equal(panel.current.title, "Matching score");
  assert.equal(catalogPanel.compareButton.disabled, false); assert.equal(attached, 1);
});

function audioApp() {
  const published = [];
  const app = { generation: 1, currentTrack: { id: "__local_music__", title: "Springtime.wav", audio: "blob:audio" },
    audioHarmony: { regions: [{ onset: 0, end: 8, rootPc: 0, templateId: "major", pcs: [0, 4, 7] }], segmentCount: 1 },
    referenceScoreButton: {}, referenceStatus: {}, referenceResults: { innerHTML: "", hidden: true },
    root: { dispatchEvent(event) { published.push(event); } }, renderAudioScoreComparison() {} };
  return { app, published };
}

test("a superseded matching-score load cannot attach to the same playing audio", async () => {
  const previousParser = globalThis.DOMParser; globalThis.DOMParser = LiteDOMParser;
  try {
    const { app, published } = audioApp();
    let resolveFirst;
    const first = CollectionAwareHolographicHarmonyApp.prototype.loadAudioReferenceScore.call(app, {
      name: "first.musicxml", text: () => new Promise(resolve => { resolveFirst = resolve; }), arrayBuffer: async () => Buffer.from(xml)
    });
    await CollectionAwareHolographicHarmonyApp.prototype.loadAudioReferenceScore.call(app, {
      name: "second.musicxml", text: async () => xml, arrayBuffer: async () => Buffer.from(xml)
    });
    resolveFirst(xml); await first;
    assert.equal(published.length, 1); assert.equal(published[0].detail.title, "second.musicxml");
    assert.equal(app.referenceScoreButton.disabled, false);
  } finally { globalThis.DOMParser = previousParser; }
});

test("a matching score publishes measured events with the actual source-byte hash and preserves open audio", async () => {
  const previousParser = globalThis.DOMParser; globalThis.DOMParser = LiteDOMParser;
  try {
    const { app, published } = audioApp(), originalTrack = app.currentTrack, originalHarmony = app.audioHarmony;
    const bytes = Buffer.from("\ufeff" + xml);
    await CollectionAwareHolographicHarmonyApp.prototype.loadAudioReferenceScore.call(app, {
      name: "Springtime.musicxml", text: async () => xml, arrayBuffer: async () => Uint8Array.from(bytes).buffer
    });
    assert.equal(published.length, 1); assert.equal(published[0].type, "harmonic-savant:score-ready");
    const detail = published[0].detail;
    assert.equal(detail.audioReference, true); assert.equal(detail.sourceFormat, "musicxml");
    assert.equal(detail.sourceId, `sha256:${createHash("sha256").update(bytes).digest("hex")}`);
    assert.equal(detail.events.length, events.length); assert.equal(app.currentTrack, originalTrack);
    assert.equal(app.audioHarmony, originalHarmony); assert.equal(app.scoreSourceId, undefined);
    assert.equal(app.referenceScoreButton.disabled, false); assert.ok(app.audioScoreComparison);
  } finally { globalThis.DOMParser = previousParser; }
});

test("changing the source while hashing a matching score cannot attach its score or catalog analysis", async () => {
  const previousParser = globalThis.DOMParser; globalThis.DOMParser = LiteDOMParser;
  try {
    const { app, published } = audioApp();
    await CollectionAwareHolographicHarmonyApp.prototype.loadAudioReferenceScore.call(app, {
      name: "Old.musicxml", text: async () => xml,
      arrayBuffer: async () => { app.generation++; return new TextEncoder().encode(xml).buffer; }
    });
    assert.equal(published.length, 0); assert.equal(app.audioReferenceScore, undefined);
    assert.equal(app.audioScoreComparison, undefined);
  } finally { globalThis.DOMParser = previousParser; }
});
