import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { prepareLocalScoreFile } from "../src/music/score-io.js";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { buildScoreHIR, serializeScoreHIR } from "../src/model/harmonic-ir.js";
import { extractHarmonicFingerprintFromHIR, serializeHIRFingerprint } from "../src/fingerprint/hir-extract.js";

const args = process.argv.slice(2), filename = args.shift();
const outputs = {};
for (let i = 0; i < args.length; i += 2) {
  if (!["--hir", "--fingerprint"].includes(args[i]) || !args[i + 1] || outputs[args[i]]) throw new Error("Usage: node scripts/analyze-score-file.mjs score.musicxml [--hir analysis.json] [--fingerprint fingerprint.json]");
  outputs[args[i]] = path.resolve(args[i + 1]);
}
if (!filename) throw new Error("A MusicXML, MXL or MIDI input file is required");
const input = path.resolve(filename), targets = Object.values(outputs);
if (targets.includes(input) || new Set(targets).size !== targets.length) throw new Error("Outputs cannot overwrite the input score or each other");
const bytes = await fs.readFile(input), sourceId = "sha256:" + createHash("sha256").update(bytes).digest("hex");
const prepared = await prepareLocalScoreFile({ name: path.basename(input), text: async () => bytes.toString("utf8"),
  arrayBuffer: async () => Uint8Array.from(bytes).buffer }, LiteDOMParser, { trackId: sourceId });
const hir = buildScoreHIR(prepared.parsed.eventsV1, { sourceId, sourceFormat: prepared.sourceFormat });
const fingerprint = extractHarmonicFingerprintFromHIR(hir);
if (outputs["--hir"]) await fs.writeFile(outputs["--hir"], serializeScoreHIR(hir) + "\n");
if (outputs["--fingerprint"]) await fs.writeFile(outputs["--fingerprint"], serializeHIRFingerprint(fingerprint) + "\n");
if (!targets.length) process.stdout.write(serializeHIRFingerprint(fingerprint) + "\n");
else process.stdout.write(JSON.stringify({ sourceId, noteEvents: hir.events.length, harmonicWindows: hir.harmonicWindows.length,
  implementedBlocks: fingerprint.capabilities.implementedBlocks, outputs }) + "\n");
