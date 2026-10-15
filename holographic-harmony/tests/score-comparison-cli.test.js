import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { validateScoreComparisonFiles, renderScoreComparisonValidation } from "../scripts/validate-score-comparison.mjs";

const fixture = fileURLToPath(new URL("../public/tracks/chromatic-voice-leading.musicxml", import.meta.url));
const script = fileURLToPath(new URL("../scripts/validate-score-comparison.mjs", import.meta.url));

test("the new real-file CLI independently re-parses sources and passes all component controls", async () => {
  const before = fs.readFileSync(fixture);
  const report = await validateScoreComparisonFiles([fixture, fixture]);
  assert.deepEqual(report.summary, { pieceCount: 2, pairCount: 1, failedControls: 0, unavailableWholeOrder: 0 });
  assert.equal(report.comparisons[0].distance, 0); assert.deepEqual(fs.readFileSync(fixture), before);
  const markdown = renderScoreComparisonValidation(report); assert.match(markdown, /not percentages/); assert.match(markdown, /Chord-candidate order/);
});

test("the new validation CLI refuses an output that would overwrite a private score", () => {
  const before = fs.readFileSync(fixture);
  const result = spawnSync(process.execPath, [script, "--json", fixture, fixture], { encoding: "utf8" });
  assert.equal(result.status, 1); assert.match(result.stderr, /cannot overwrite/); assert.deepEqual(fs.readFileSync(fixture), before);
});

test("the new validation CLI rejects unknown options and missing score inputs", () => {
  assert.match(spawnSync(process.execPath, [script, "--total-similarity"], { encoding: "utf8" }).stderr, /Unknown option/);
  assert.match(spawnSync(process.execPath, [script], { encoding: "utf8" }).stderr, /Usage:/);
});
