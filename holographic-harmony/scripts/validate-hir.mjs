import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prepareLocalScoreFile } from "../src/music/score-io.js";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { buildScoreHIR, harmonicStateAt, serializeScoreHIR, parseScoreHIR, transposeScoreHIR } from "../src/model/harmonic-ir.js";
import { extractHarmonicFingerprintFromHIR, validateHIRFingerprint } from "../src/fingerprint/hir-extract.js";
import { deriveScoreComparison, deriveScoreComparisonFromHIR, compareScoreComparisons } from "../src/similarity/score-comparison.js";
import { transposeEvents } from "../src/theory/transposition.js";
import { computePitchClassActivity } from "../src/theory/activity.js";
import { computeAdmissionHistory } from "../src/theory/admissions.js";
import { complementField } from "../src/theory/fields.js";

function equalWithin(a, b, epsilon = 1e-10) {
  if (typeof a === "number") return typeof b === "number" && Math.abs(a - b) < epsilon;
  if (!a || typeof a !== "object") return a === b;
  return b && typeof b === "object" && JSON.stringify(Object.keys(a).sort()) === JSON.stringify(Object.keys(b).sort()) && Object.keys(a).every(key => equalWithin(a[key], b[key], epsilon));
}
const zero = value => Object.values(value.components).every(x => x == null || Math.abs(x) < 1e-12);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const args = process.argv.slice(2), files = []; let output;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--json" && !output && args[i + 1]) output = path.resolve(args[++i]);
  else if (args[i].startsWith("--")) throw new Error(`Unknown or incomplete option: ${args[i]}`);
  else files.push(path.resolve(args[i]));
}
if (!files.length || files.includes(output)) throw new Error("Usage: node scripts/validate-hir.mjs [--json report.json] score.musicxml [...]; outputs must not overwrite source files");
const pieces = [];
for (const filename of files) {
  const bytes = await fs.readFile(filename), sha256 = hash(bytes), sourceId = `sha256:${sha256}`;
  const prepared = await prepareLocalScoreFile({ name: path.basename(filename), text: async () => bytes.toString("utf8"), arrayBuffer: async () => Uint8Array.from(bytes).buffer }, LiteDOMParser, { trackId: sourceId });
  const events = prepared.parsed.eventsV1, before = JSON.stringify(events), options = { sourceId, sourceFormat: prepared.sourceFormat };
  const started = performance.now(), hir = buildScoreHIR(events, options), fingerprint = extractHarmonicFingerprintFromHIR(hir);
  const analysisMilliseconds = performance.now() - started;
  const projected = deriveScoreComparisonFromHIR(hir), legacy = deriveScoreComparison(events, options);
  assert.deepEqual(projected, legacy);
  const text = serializeScoreHIR(hir), restored = parseScoreHIR(text);
  const shifted = transposeScoreHIR(hir, 5), independentlyShifted = buildScoreHIR(transposeEvents(events, 5), options);
  const back = transposeScoreHIR(shifted, -5);
  const slower = buildScoreHIR(events.map(event => ({ ...event, onsetSec: event.onsetSec * 2, durationSec: event.durationSec * 2, endSec: event.endSec * 2 })), options);
  const checkpoints = [0, hir.durationSec / 2, hir.durationSec];
  let liveParity = true;
  for (const time of checkpoints) {
    const activeField = hir.referenceField, activity = computePitchClassActivity(prepared.parsed.notes, time);
    const admissions = computeAdmissionHistory(prepared.parsed.notes, complementField(activeField), time);
    const state = harmonicStateAt(hir, time, { activeField, activity, admissionHistory: admissions });
    liveParity &&= equalWithin(state.measured.pitchClassActivity, activity.raw) && equalWithin(state.holographic.admissionHistory, admissions);
  }
  const checks = { legacyDescriptorExact: true, nineBlocksValid: validateHIRFingerprint(fingerprint),
    canonicalRoundTrip: serializeScoreHIR(restored) === text,
    normalizedDeclaredTransposition: equalWithin(fingerprint.normalized, extractHarmonicFingerprintFromHIR(shifted).normalized),
    normalizedInferredTransposition: equalWithin(fingerprint.normalized, extractHarmonicFingerprintFromHIR(independentlyShifted).normalized),
    pitchRoundTrip: equalWithin(events.map(x => x.midi), back.events.map(x => x.midi)),
    eightMetricTransposition: zero(compareScoreComparisons(projected, deriveScoreComparisonFromHIR(shifted))),
    eightMetricTempo: zero(compareScoreComparisons(projected, deriveScoreComparisonFromHIR(slower))),
    liveProjectionParity: liveParity, eventsUnchanged: JSON.stringify(events) === before,
    bytesUnchanged: hash(await fs.readFile(filename)) === sha256 };
  pieces.push({ name: path.basename(filename), sha256, sourceFormat: prepared.sourceFormat, noteEvents: hir.events.length,
    harmonicWindows: hir.harmonicWindows.length, analysisMilliseconds, hirExportBytes: Buffer.byteLength(text),
    normalizationReferencePc: hir.selectedReferenceCenter.pc, referenceAmbiguous: hir.selectedReferenceCenter.ambiguous, checks });
  process.stderr.write(`${path.basename(filename)}: ${hir.events.length} notes / ${hir.harmonicWindows.length} windows; ${analysisMilliseconds.toFixed(0)} ms; ${Object.values(checks).every(Boolean) ? "PASS" : "FAIL"}\n`);
}
const report = { version: "hir-validation-v1", analysisVersion: "0.3.0-hir-nine-blocks", generatedAt: new Date().toISOString(),
  story: "MusicXML/MXL/MIDI → canonical events → HIR → nine-block fingerprint, compatible eight-component comparisons, shared visualizer state and JSON exports.",
  scope: "Bounded symbolic validation. No full Fingerprint V1, local center-trajectory, voice-leading, listener probability or authoritative large-corpus claim.",
  pieces, summary: { pieceCount: pieces.length, failedControls: pieces.filter(x => !Object.values(x.checks).every(Boolean)).length,
    maximumAnalysisMilliseconds: Math.max(...pieces.map(x => x.analysisMilliseconds)), maximumHIRExportBytes: Math.max(...pieces.map(x => x.hirExportBytes)) } };
if (output) await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
process.stdout.write(JSON.stringify(output ? report.summary : report, null, 2) + "\n");
if (report.summary.failedControls) process.exitCode = 1;
