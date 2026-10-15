import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { prepareLocalScoreFile } from "../src/music/score-io.js";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { transposeEvents } from "../src/theory/transposition.js";
import { deriveScoreComparison, compareScoreComparisons, SCORE_COMPARISON_VERSION, SCORE_COMPONENTS } from "../src/similarity/score-comparison.js";

const allZero = comparison => Object.values(comparison.components).every(value => value == null || Math.abs(value) < 1e-12);
const compact = comparison => ({ sourceA: comparison.sourceA, sourceB: comparison.sourceB,
  distance: comparison.distance, components: comparison.components, shiftBToA: comparison.shiftBToA,
  order: comparison.order, candidateOrder: comparison.candidateOrder, opening: comparison.opening, unavailable: comparison.unavailable });

export async function validateScoreComparisonFiles(filePaths, { onProgress = () => {} } = {}) {
  const descriptors = [], pieces = [], controls = [];
  for (const filename of filePaths) {
    const bytes = await fs.readFile(filename), name = path.basename(filename);
    const hash = createHash("sha256").update(bytes).digest("hex"), sourceId = `sha256:${hash}`;
    const file = { name, text: async () => bytes.toString("utf8"), arrayBuffer: async () => Uint8Array.from(bytes).buffer };
    const prepared = await prepareLocalScoreFile(file, LiteDOMParser, { trackId: sourceId });
    const events = prepared.parsed.eventsV1;
    const before = JSON.stringify(events), started = performance.now();
    const descriptor = deriveScoreComparison(events, { sourceId, sourceFormat: prepared.sourceFormat });
    const deriveMilliseconds = performance.now() - started;
    const transposed = deriveScoreComparison(transposeEvents(events, 5), { sourceId: sourceId + "@+5" });
    const slowed = deriveScoreComparison(events.map(event => ({ ...event, onsetSec: event.onsetSec * 2,
      durationSec: event.durationSec * 2, endSec: event.endSec * 2 })), { sourceId: sourceId + "@time2" });
    const self = compareScoreComparisons(descriptor, descriptor);
    const shift = compareScoreComparisons(descriptor, transposed);
    const tempo = compareScoreComparisons(descriptor, slowed);
    descriptors.push(descriptor); pieces.push({ name, sourceId, sha256: hash, counts: descriptor.counts,
      provenance: descriptor.provenance, deriveMilliseconds, durationSeconds: descriptor.durationSeconds });
    controls.push({ sourceId, self: compact(self), transposed: compact(shift), slowed: compact(tempo),
      checks: { self: allZero(self), transposition: allZero(shift), uniformTempo: allZero(tempo), sourceUnchanged: JSON.stringify(events) === before } });
    onProgress(`${name}: ${descriptor.counts.notes} notes, ${descriptor.counts.regions} regions; ${deriveMilliseconds.toFixed(0)} ms; controls ${Object.values(controls.at(-1).checks).every(Boolean) ? "PASS" : "FAIL"}`);
  }
  const comparisons = [];
  for (let i = 0; i < descriptors.length; i++) for (let j = i + 1; j < descriptors.length; j++) {
    const started = performance.now();
    comparisons.push({ ...compact(compareScoreComparisons(descriptors[i], descriptors[j])), computeMilliseconds: performance.now() - started });
  }
  return { version: SCORE_COMPARISON_VERSION, definitions: SCORE_COMPONENTS,
    scope: "Local score component validation. No listener calibration, composite similarity weights, audio transcription or matched-passage claims.",
    pieces, controls, comparisons,
    summary: { pieceCount: pieces.length, pairCount: comparisons.length,
      failedControls: controls.filter(control => !Object.values(control.checks).every(Boolean)).length,
      unavailableWholeOrder: comparisons.filter(comparison => comparison.order.distance == null).length } };
}

export function renderScoreComparisonValidation(report) {
  const number = value => value == null ? "unavailable" : value.toFixed(4);
  const names = new Map(report.pieces.map(piece => [piece.sourceId, piece.name]));
  const lines = ["# Score comparison validation", "", `Engine: \`${report.version}\``, "", report.scope, "",
    `${report.summary.pieceCount} files; ${report.summary.pairCount} pair comparisons; ${report.summary.failedControls} failed control groups; ${report.summary.unavailableWholeOrder} unavailable whole-score order results.`, "",
    "## Transformation controls", "", "| Score | Notes | Regions | Self | +5 semitones | Duration ×2 | Input unchanged | Derive ms |",
    "|---|---:|---:|---|---|---|---|---:|"];
  for (let i = 0; i < report.pieces.length; i++) {
    const piece = report.pieces[i], checks = report.controls[i].checks;
    lines.push(`| ${piece.name} | ${piece.counts.notes} | ${piece.counts.regions} | ${checks.self} | ${checks.transposition} | ${checks.uniformTempo} | ${checks.sourceUnchanged} | ${piece.deriveMilliseconds.toFixed(0)} |`);
  }
  lines.push("", "Every available component must remain zero within 1e-12 in each control; unavailable components are not counted as matching evidence.", "",
    "## Pair distances", "", "| Pair | Sonority order | Pitch content | Bass | Vertical intervals | Upper intervals | Attack rhythm | Sonority durations | Chord candidates | Compute ms |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const comparison of report.comparisons) lines.push(`| ${names.get(comparison.sourceA)} ↔ ${names.get(comparison.sourceB)} | ${SCORE_COMPONENTS.map(component => number(comparison.components[component.key])).join(" | ")} | ${comparison.computeMilliseconds.toFixed(0)} |`);
  lines.push("", "Values are feature-specific distances, not percentages of musical similarity. Each pair uses the same displayed global shift, chosen by whole-score sonority order; openings are separately scoped. Expression and touch are not represented by these symbolic distances.", "", "## Definitions", "");
  for (const component of report.definitions) lines.push(`- **${component.label} (${component.evidence}):** ${component.definition}`);
  lines.push("", "## Source identity", "", "| Score | SHA-256 |", "|---|---|");
  for (const piece of report.pieces) lines.push(`| ${piece.name} | \`${piece.sha256}\` |`);
  return lines.join("\n") + "\n";
}

async function main() {
  const args = process.argv.slice(2), files = []; let jsonPath, markdownPath;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--json" || args[i] === "--markdown") {
      const flag = args[i], value = args[++i]; if (!value || value.startsWith("--")) throw new Error(`${flag} requires a path`);
      if (flag === "--json") jsonPath = value; else markdownPath = value;
    } else if (args[i].startsWith("--")) throw new Error(`Unknown option: ${args[i]}`);
    else files.push(args[i]);
  }
  if (!files.length) throw new Error("Usage: node scripts/validate-score-comparison.mjs [--json report.json] [--markdown report.md] score.musicxml [...]");
  const inputs = new Set(files.map(filename => path.resolve(filename)));
  if ([jsonPath, markdownPath].filter(Boolean).some(filename => inputs.has(path.resolve(filename))) || (jsonPath && markdownPath && path.resolve(jsonPath) === path.resolve(markdownPath))) throw new Error("Outputs cannot overwrite input scores or each other");
  const report = await validateScoreComparisonFiles(files, { onProgress: message => process.stderr.write(message + "\n") });
  if (jsonPath) await fs.writeFile(jsonPath, JSON.stringify(report, null, 2) + "\n");
  if (markdownPath) await fs.writeFile(markdownPath, renderScoreComparisonValidation(report));
  if (!jsonPath && !markdownPath) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  else process.stdout.write(JSON.stringify(report.summary) + "\n");
  if (report.summary.failedControls) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { process.stderr.write(error.message + "\n"); process.exitCode = 1; });
