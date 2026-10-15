import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { parseMusicXML } from "../src/music/musicxml.js";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { transposeEvents } from "../src/theory/transposition.js";
import { deriveScoreComparison, compareScoreComparisons, compareScoreDistributionSummaries,
  projectScoreDistributionSummary, SCORE_DISTRIBUTION_COMPONENTS, SCORE_COMPARISON_VERSION } from "../src/similarity/score-comparison.js";
import { REFERENCE_CATALOG_VERSION, validateReferenceCatalog, shortlistReferenceCatalog, validateCatalogDescriptor } from "../src/corpus/reference-catalog.js";
import { ReferenceCatalogPanel } from "../src/app/reference-catalog-panel.js";
import { processScoreComparisonRequest } from "../src/similarity/score-comparison-service.js";

const events = parseMusicXML(fs.readFileSync(new URL("../public/tracks/chromatic-voice-leading.musicxml", import.meta.url), "utf8"), LiteDOMParser).eventsV1;
const make = (index, shift = 0) => deriveScoreComparison(transposeEvents(events, shift), { sourceId: `sha256:${index.toString(16).padStart(64, "0")}`, sourceFormat: "mxl" });
const current = make(1), other = make(2, 5);
const reference = (descriptor, metadata = {}) => ({ id: `pdmx:${descriptor.sourceId.slice(7)}`, sha256: descriptor.sourceId.slice(7), title: "Reference piece", composer: "Example composer",
  genres: ["classical"], tags: ["quartet"], instruments: ["Piano"], rights: { license: "publicdomain", licenseConflict: false }, counts: descriptor.counts,
  summary: projectScoreDistributionSummary(descriptor), descriptorFile: "shards/pdmx-000.json", descriptorSha256: "a".repeat(64), ...metadata });
const manifest = records => ({ version: REFERENCE_CATALOG_VERSION, id: "pdmx-test", count: records.length, analysisVersion: SCORE_COMPARISON_VERSION,
  source: { doi: "10.5281/zenodo.15571083", selection: "fixture" }, records });

test("catalog distribution projection exactly agrees with full comparison for every metric and transposition", () => {
  for (let shift = 0; shift < 12; shift++) {
    const b = make(2, shift);
    for (const rankBy of SCORE_DISTRIBUTION_COMPONENTS) {
      const summary = compareScoreDistributionSummaries(projectScoreDistributionSummary(current), projectScoreDistributionSummary(b), { rankBy });
      const full = compareScoreComparisons(current, b, { rankBy });
      assert.equal(summary.distance, full.distance); assert.equal(summary.shiftBToA, full.shiftBToA);
      for (const key of SCORE_DISTRIBUTION_COMPONENTS) assert.equal(summary.components[key], full.components[key]);
    }
  }
});

test("catalog metadata filters combine and exact reference identities remain eligible matches", () => {
  const a = reference(current), b = reference(other), c = reference(make(3), { title: "Jazz study", composer: "Different person", genres: ["jazz"], instruments: ["Violin"] });
  const catalog = manifest([a, b, c]); assert.equal(validateReferenceCatalog(catalog), true);
  const result = shortlistReferenceCatalog(current, catalog, { query: "EXAMPLE", genre: "classical", instrument: "Piano" });
  assert.equal(result.totalRecords, 3); assert.equal(result.filteredRecords, 2); assert.equal(result.items.some(item => item.id === a.id), true);
  assert.equal(result.items.every(item => item.summaryComparison.distance === 0), true);
  assert.equal(shortlistReferenceCatalog(current, catalog, { query: "missing title" }).items.length, 0);
  assert.equal(shortlistReferenceCatalog(current, catalog, { genre: "jazz", instrument: "Piano" }).filteredRecords, 0);
  const composed = shortlistReferenceCatalog(current, catalog, { composer: "Different person" });
  assert.equal(composed.filteredRecords, 1); assert.equal(composed.filters.composer, "Different person");
  assert.equal(shortlistReferenceCatalog(current, catalog, { composer: "Different person", genre: "classical" }).filteredRecords, 0);
});

test("catalog preferences retain explicit composer and survive blocked browser storage", () => {
  let persisted;
  const panel = { query: { value: "Bach" }, composer: { value: "Example composer" }, genre: { value: "classical" },
    instrument: { value: "Piano" }, rankBy: { value: "candidateOrder" }, storage: { setItem(key, value) { persisted = JSON.parse(value); } } };
  ReferenceCatalogPanel.prototype.persistFilters.call(panel);
  assert.deepEqual(persisted, { query: "Bach", composer: "Example composer", genre: "classical", instrument: "Piano", rankBy: "candidateOrder" });
  panel.storage.setItem = () => { throw new Error("blocked"); };
  assert.doesNotThrow(() => ReferenceCatalogPanel.prototype.persistFilters.call(panel));
});

test("distribution rankings are exhaustive over filtered records and deterministic across catalog order", () => {
  const records = Array.from({ length: 24 }, (_, i) => reference(make(i + 2, i % 12)));
  const a = shortlistReferenceCatalog(current, manifest(records), { rankBy: "pitchContent", limit: 5 });
  const b = shortlistReferenceCatalog(current, manifest([...records].reverse()), { rankBy: "pitchContent", limit: 5 });
  assert.deepEqual(a.items, b.items); assert.equal(a.comparableRecords, 24); assert.equal(a.items.length, 5);
  assert.equal(a.scope, "exhaustive-feature-ranking"); assert.equal(a.items[0].summaryComparison.distance, 0);
});

test("order search declares a pitch shortlist rather than claiming an exhaustive order nearest neighbor", () => {
  const result = shortlistReferenceCatalog(current, manifest([reference(other)]), { rankBy: "candidateOrder" });
  assert.equal(result.scope, "pitch-shortlist-order-reranking"); assert.equal(result.shortlistBy, "pitchContent");
  assert.match(result.note, /not a guaranteed whole-catalog/);
  assert.throws(() => compareScoreDistributionSummaries(current, other, { rankBy: "sonorityOrder" }), /cannot stand in/);
  assert.throws(() => shortlistReferenceCatalog(current, manifest([reference(other)]), { limit: 51 }), /1–50/);
});

test("unavailable catalog evidence is excluded from the comparable count rather than counted as a zero match", () => {
  const record = reference(other); record.summary = structuredClone(record.summary); record.summary.distributions.upperIntervals = null;
  const result = shortlistReferenceCatalog(current, manifest([record]), { rankBy: "upperIntervals" });
  assert.equal(result.filteredRecords, 1); assert.equal(result.comparableRecords, 0); assert.equal(result.unavailableRecords, 1); assert.deepEqual(result.items, []);
});

test("corrupt, conflicting, duplicated, old-version and traversal-path catalogs fail closed", () => {
  const catalog = manifest([reference(other)]);
  for (const mutate of [x => x.records[0].summary.version = "old", x => x.records[0].summary.distributions.pitchContent[0] = 99,
    x => x.records[0].descriptorFile = "../../private.json", x => x.records[0].rights.licenseConflict = true,
    x => x.records.push(structuredClone(x.records[0])), x => x.records[0].sha256 = "not-a-hash"]) {
    const corrupt = structuredClone(catalog); mutate(corrupt); assert.equal(validateReferenceCatalog(corrupt), false);
  }
  assert.throws(() => shortlistReferenceCatalog(current, { ...catalog, version: "old" }), /compatible/);
});

test("catalog descriptor must agree with its summary, counts and source identity", () => {
  const record = reference(other); assert.equal(validateCatalogDescriptor(record, other), true);
  assert.equal(validateCatalogDescriptor(record, current), false);
  const changed = structuredClone(other); changed.distributions.upperIntervals = { 7: 1 };
  assert.equal(validateCatalogDescriptor(record, changed), false);
});

test("records sharing a shard cannot disagree about its expected bytes", () => {
  const catalog = manifest([reference(other), reference(make(3), { descriptorSha256: "b".repeat(64) })]);
  assert.equal(validateReferenceCatalog(catalog), false);
});

test("downloaded descriptor shards are checksum checked and cached, with no query or private-score data in URLs", async () => {
  const text = JSON.stringify({ version: REFERENCE_CATALOG_VERSION, catalogId: "pdmx-test", records: [{ id: reference(other).id, scoreDescriptor: other }] });
  const record = { ...reference(other), descriptorSha256: createHash("sha256").update(text).digest("hex") };
  const urls = [], panel = { shards: new Map(), catalog: manifest([record]), fetch: async url => { urls.push(String(url)); return { ok: true, text: async () => text }; } };
  const a = await ReferenceCatalogPanel.prototype.loadShard.call(panel, record), b = await ReferenceCatalogPanel.prototype.loadShard.call(panel, record);
  assert.deepEqual(a, other); assert.equal(a, b); assert.equal(urls.length, 1); assert.match(urls[0], /shards\/pdmx-000\.json$/); assert.equal(new URL(urls[0]).search, "");
  const corrupt = { ...panel, shards: new Map(), fetch: async () => ({ ok: true, text: async () => text + " " }) };
  await assert.rejects(ReferenceCatalogPanel.prototype.loadShard.call(corrupt, record), /checksum mismatch/);
});

test("a source change during catalog ranking suppresses stale results", async () => {
  let resolve;
  const pending = new Promise(done => resolve = done), calls = [];
  const panel = { current: { title: "Old source", scoreDescriptor: current }, catalog: manifest([reference(other)]), generation: 0,
    results: { replaceChildren() {} }, exportButton: {}, updateControls() {}, status: {},
    rankBy: { value: "pitchContent" }, query: { value: "" }, genre: { value: "" }, instrument: { value: "" },
    request: () => pending, renderComparison: item => calls.push(item) };
  const search = ReferenceCatalogPanel.prototype.search.call(panel); panel.generation++; panel.current = null;
  resolve(shortlistReferenceCatalog(current, panel.catalog)); await search;
  assert.equal(calls.length, 0); assert.equal(panel.latestReport, null); assert.equal(panel.exportButton.disabled, true);
});

test("catalog ranking is exposed through the same host-independent worker service", () => {
  const catalog = manifest([reference(other)]);
  const result = processScoreComparisonRequest({ type: "catalog-shortlist", current, catalog, options: { rankBy: "bass" } });
  assert.equal(result.items[0].summaryComparison.distance, 0); assert.equal(result.scope, "exhaustive-feature-ranking");
});
