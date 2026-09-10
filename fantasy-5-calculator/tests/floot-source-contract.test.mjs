import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../floot-source/", import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), "utf8");

const required = [
  "pages/_index.tsx",
  "pages/_index.module.css",
  "pages/_index.pageLayout.tsx",
  "helpers/fantasy5Geometry.tsx",
  "helpers/fantasy5Geometry.spec.tsx",
  "helpers/stateSpaceGeometry.tsx",
  "helpers/stateSpaceGeometry.spec.tsx",
  "components/Input.tsx",
  "components/Input.module.css",
  "components/Button.tsx",
  "components/Button.module.css",
  "components/Select.tsx",
  "components/Select.module.css",
  "base.css",
  "manifest.json",
  "README.md",
];

test("exports the complete page import closure", () => {
  for (const path of required) {
    assert.ok(fs.statSync(new URL(path, root)).size > 0, `${path} must be present and non-empty`);
  }
});

test("locks the polished integrated feature surface", () => {
  const page = read("pages/_index.tsx");
  assert.match(page, /Lottery Geometry Calculator/);
  assert.match(page, /D×G realizable map/);
  assert.match(page, /Scale–translation base/);
  assert.match(page, /Intrinsic q-space fiber/);
  assert.match(page, /Fantasy 5 · 1–42/);
  assert.match(page, /Powerball white balls · 1–69/);
  assert.match(page, /Mega Millions white balls · 1–70/);
});

test("locks the scientific authorities and provenance", () => {
  const fantasy = read("helpers/fantasy5Geometry.tsx");
  const state = read("helpers/stateSpaceGeometry.tsx");
  const manifest = JSON.parse(read("manifest.json"));
  assert.match(fantasy, /TOTAL: 850668/);
  assert.match(fantasy, /occupiedCells/);
  assert.match(state, /statesAtR:shapeCount\*translations/);
  assert.match(state, /lambda:1-1\/D/);
  assert.equal(manifest.flootCheckpointId, "aae1c03e-6226-4c32-b5df-3793c38b6cab");
  assert.equal(manifest.publishedUrl, "https://fantasy5-geometry.floot.app");
  assert.equal(manifest.verification.flootSpecs.filesFailed, 0);
});
