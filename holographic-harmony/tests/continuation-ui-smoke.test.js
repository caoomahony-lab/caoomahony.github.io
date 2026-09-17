import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ContinuationPanel } from "../src/app/continuation-panel.js";
import { HarmonicSavantApp } from "../src/app/harmonic-savant-app.js";

test("continuation browser modules are importable without executing DOM constructors", () => {
  assert.equal(typeof ContinuationPanel, "function");
  assert.equal(typeof HarmonicSavantApp, "function");
});

test("static entrypoint loads both legacy visualizer and additive continuation styles", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /src\/styles\/app\.css/);
  assert.match(html, /src\/styles\/continuation\.css/);
  assert.match(html, /src\/main\.js/);
});
