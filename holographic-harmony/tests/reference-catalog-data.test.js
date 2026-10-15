import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { validateReferenceCatalog, validateCatalogDescriptor, shortlistReferenceCatalog } from "../src/corpus/reference-catalog.js";
import { compareScoreComparisons } from "../src/similarity/score-comparison.js";

const base = new URL("../public/catalog/pdmx-v9/", import.meta.url);
const catalog = JSON.parse(fs.readFileSync(new URL("manifest.json", base), "utf8"));
const descriptors = new Map();

test("the shipped 500-score PDMX pilot has pinned provenance and checksum-valid complete comparison records", () => {
  assert.equal(validateReferenceCatalog(catalog), true); assert.equal(catalog.count, 500);
  assert.equal(catalog.source.doi, "10.5281/zenodo.15571083"); assert.equal(catalog.source.csvMd5, "30392ccf38bb63ce70e7afae70f9c88c");
  const shards = new Map();
  for (const record of catalog.records) {
    if (!shards.has(record.descriptorFile)) {
      const bytes = fs.readFileSync(new URL(record.descriptorFile, base));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), record.descriptorSha256);
      const shard = JSON.parse(bytes); assert.equal(shard.catalogId, catalog.id);
      shards.set(record.descriptorFile, new Map(shard.records.map(item => [item.id, item.scoreDescriptor])));
    }
    const descriptor = shards.get(record.descriptorFile).get(record.id);
    assert.equal(validateCatalogDescriptor(record, descriptor), true); assert.equal(record.provenance.hirSchemaVersion, null);
    assert.equal(descriptor.provenance.sourceFormat, "mxl"); assert.equal(record.rights.licenseConflict, false);
    descriptors.set(record.id, descriptor);
  }
  assert.equal(descriptors.size, 500); assert.equal(shards.size, 20);
});

test("real catalog references retain zero self-distance and exhaustive distribution ranking across the pilot", () => {
  for (const record of catalog.records.filter((_, i) => i % 50 === 0)) {
    const descriptor = descriptors.get(record.id);
    const self = compareScoreComparisons(descriptor, descriptor);
    assert.equal(Object.values(self.components).every(value => value == null || value < 1e-12), true);
    const nearest = shortlistReferenceCatalog(descriptor, catalog, { rankBy: "pitchContent" });
    assert.equal(nearest.filteredRecords, 500); assert.equal(nearest.scope, "exhaustive-feature-ranking");
    assert.equal(nearest.items[0].summaryComparison.distance < 1e-12, true);
  }
});
