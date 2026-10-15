import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { auditScoreFiles, renderScoreAuditMarkdown } from "../scripts/audit-score-similarity.mjs";

const fixture = fileURLToPath(new URL("../public/tracks/chromatic-voice-leading.musicxml", import.meta.url));
const script = fileURLToPath(new URL("../scripts/audit-score-similarity.mjs", import.meta.url));

test("score-file audit validates copied scores and transformations with reproducible identities", async () => {
  const before = fs.readFileSync(fixture), report = await auditScoreFiles([fixture, fixture]);
  assert.equal(report.pieces.length, 2);
  assert.equal(report.comparisons.length, 1);
  assert.equal(report.pieces[0].sha256, report.pieces[1].sha256);
  assert.equal(report.comparisons[0].auditedSummaryDistance, 0);
  assert.equal(report.comparisons[0].measuredSonorityOrder.distance, 0);
  for (const control of report.controls) {
    assert.equal(control.checks.selfSummary, true);
    assert.equal(control.checks.transposedMeasuredOrder, true);
    assert.equal(control.checks.tempoScaledMeasuredOrder, true);
  }
  assert.deepEqual(fs.readFileSync(fixture), before);
  const markdown = renderScoreAuditMarkdown(report);
  assert.match(markdown, /7\/8 summary components/);
  assert.match(markdown, /not probabilities/);
  assert.match(markdown, /SHA-256/);
});

test("CLI refuses to overwrite its input score before starting analysis", () => {
  const before = fs.readFileSync(fixture);
  const result = spawnSync(process.execPath, [script, "--json", fixture, fixture], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot overwrite an input score/);
  assert.deepEqual(fs.readFileSync(fixture), before);
});

test("CLI fails clearly on missing paths and unsupported options", () => {
  const result = spawnSync(process.execPath, [script, "--unknown"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option/);
  assert.match(spawnSync(process.execPath, [script], { encoding: "utf8" }).stderr, /Usage:/);
});
