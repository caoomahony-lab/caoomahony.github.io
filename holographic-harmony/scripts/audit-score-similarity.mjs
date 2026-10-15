import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { parseMusicXML } from "../src/music/musicxml.js";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { transposeEvents } from "../src/theory/transposition.js";
import { extractPitchEcology } from "../src/fingerprint/blocks/pitch-ecology.js";
import { orderedHarmonyDistance } from "../src/similarity/evidence-aware-distance.js";
import {
  SCORE_SIMILARITY_AUDIT_VERSION, deriveScoreSimilarityAudit, compareScoreSimilarityAudits
} from "../src/validation/score-similarity-audit.js";

const nearZero = (value) => Number.isFinite(value) && Math.abs(value) <= 1e-12;

function measuredProfile(events) {
  const ecology = extractPitchEcology(events, { centerPc: 0 });
  const chroma = ecology.relativeDurationDistribution;
  const major = [0, 2, 4, 5, 7, 9, 11];
  const collections = Array.from({ length: 12 }, (_, shift) => {
    const pcs = major.map((pc) => (pc + shift) % 12).sort((a, b) => a - b);
    return { pcs, share: pcs.reduce((sum, pc) => sum + chroma[pc], 0) };
  }).sort((a, b) => b.share - a.share || a.pcs.join(",").localeCompare(b.pcs.join(",")));
  return {
    pitchEntropy: ecology.entropy,
    durationWeightedPitchClassDistribution: chroma,
    bestDiatonicCollection: collections[0],
    note: "The best diatonic collection is a maximum over the 12 major-scale pitch sets, including their relative modes. This is pitch coverage, not a tonic or functional-harmony verdict."
  };
}

function compactComparison(result) {
  return {
    sourceA: result.sourceA, sourceB: result.sourceB,
    originalSummaryDistance: result.summary.original.distance,
    auditedSummaryDistance: result.summary.distance,
    families: result.summary.families,
    components: result.summary.components,
    coverage: result.summary.coverage,
    inferredChordOrder: result.summary.orderedHarmony,
    measuredSonorityOrder: result.measuredOrder,
    openingPassage: result.openingPassage
  };
}

export async function auditScoreFiles(filePaths, { onProgress = () => {} } = {}) {
  if (!Array.isArray(filePaths) || !filePaths.length) throw new TypeError("Provide at least one score path");
  const analyzed = [], pieces = [], controls = [];
  for (let index = 0; index < filePaths.length; index += 1) {
    const bytes = await fs.readFile(filePaths[index]);
    const name = path.basename(filePaths[index]), sourceId = `score-${index + 1}:${name}`;
    const parsed = parseMusicXML(bytes.toString("utf8"), LiteDOMParser, { trackId: sourceId });
    if (!parsed.eventsV1.length) throw new Error(`${name}: no canonical pitched score events`);
    const audit = deriveScoreSimilarityAudit(parsed.eventsV1, { sourceId });
    analyzed.push(audit);
    pieces.push({ sourceId, name, sha256: createHash("sha256").update(bytes).digest("hex"),
      ...audit.counts, durationSeconds: audit.durationSeconds, provenance: audit.provenance,
      profile: measuredProfile(parsed.eventsV1) });
    onProgress(`${name}: ${audit.counts.notes} notes, ${audit.counts.sonorityRegions} sonority regions`);
    const self = compareScoreSimilarityAudits(audit, audit);
    const shifted = deriveScoreSimilarityAudit(transposeEvents(parsed.eventsV1, 5), { sourceId: `${sourceId}@transpose+5` });
    const transposed = compareScoreSimilarityAudits(audit, shifted);
    const scaled = parsed.eventsV1.map((event) => ({ ...event, onsetSec: event.onsetSec * 2,
      durationSec: event.durationSec * 2, endSec: event.endSec * 2 }));
    const tempo = compareScoreSimilarityAudits(audit, deriveScoreSimilarityAudit(scaled, { sourceId: `${sourceId}@durationx2` }));
    const opening = audit.measuredSequence.slice(0, 64);
    const reversedOpening = orderedHarmonyDistance(opening, [...opening].reverse());
    controls.push({ sourceId,
      self: compactComparison(self),
      transposedFiveSemitones: compactComparison(transposed),
      globalDurationScaleTwo: compactComparison(tempo),
      reversedOpeningSonorities: { ...reversedOpening,
        selection: "first 64 measured sonorities, reversed after extraction; score file untouched" },
      checks: {
        selfSummary: nearZero(self.summary.distance), selfMeasuredOrder: nearZero(self.measuredOrder.distance),
        transposedMeasuredOrder: nearZero(transposed.measuredOrder.distance),
        tempoScaledMeasuredOrder: nearZero(tempo.measuredOrder.distance),
        transposedSummary: nearZero(transposed.summary.distance),
        transposedInferredChordOrder: transposed.summary.orderedHarmony.distance == null
          ? null : nearZero(transposed.summary.orderedHarmony.distance),
        tempoScaledSummary: nearZero(tempo.summary.distance)
      }
    });
    onProgress(`${name}: controlled transformations completed`);
  }
  const comparisons = [];
  for (let i = 0; i < analyzed.length; i += 1) for (let j = i + 1; j < analyzed.length; j += 1) {
    comparisons.push(compactComparison(compareScoreSimilarityAudits(analyzed[i], analyzed[j])));
  }
  return {
    version: SCORE_SIMILARITY_AUDIT_VERSION,
    config: { transpositionSemitones: 5, durationScale: 2, openingRegionLimit: 64, orderCellUpdateLimit: 3_000_000 },
    scope: "Local symbolic-score diagnostic; no audio transcription, listener calibration, corpus percentile or new composite weights.",
    pieces, controls, comparisons,
    limits: [
      "The top-note proxy groups attacks within a fixed 0.09 seconds and is not verified melody.",
      "Chord roots and families are inferred and can change at tied interpretations under transposition.",
      "Measured sonority order retains pitch-class sets and bass class, not register, voice assignment, rests or rhythm.",
      "Whole-piece order can be unavailable above the calculation budget; the opening result is labeled separately.",
      "Control transformations validate definitions; they do not establish listener judgments for different compositions."
    ]
  };
}

export function renderScoreAuditMarkdown(report) {
  const f = (value) => value == null ? "unavailable" : value.toFixed(4);
  const order = (result) => result.distance == null ? `unavailable (${result.reason})` : f(result.distance);
  const names = new Map(report.pieces.map((piece) => [piece.sourceId, piece.name]));
  const measuredPasses = report.controls.filter((control) => control.checks.selfMeasuredOrder &&
    control.checks.transposedMeasuredOrder && control.checks.tempoScaledMeasuredOrder).length;
  const transpositionChanges = report.controls.filter((control) => control.checks.transposedSummary === false).length;
  const tempoChanges = report.controls.filter((control) => control.checks.tempoScaledSummary === false).length;
  const lines = ["# Harmonic score comparison validation", "", `Engine: \`${report.version}\``, "", report.scope, "",
    `The measured sonority-order diagnostic passes self, transposition and global-tempo controls for ${measuredPasses}/${report.controls.length} score files. The existing summary changes under transposition for ${transpositionChanges} files and global tempo scaling for ${tempoChanges} files. These failures need resolution before the summary can be treated as invariant.`, "",
    "Distances use 0 for equality under the stated feature and 1 for maximal difference. They are not probabilities or percentages of shared music.", "",
    "## Scores", "", "| Score | Notes | Sonority regions | Tied top chord labels | Duration (s) | Best diatonic pitch coverage |", "|---|---:|---:|---:|---:|---:|"];
  for (const piece of report.pieces) lines.push(`| ${piece.name} | ${piece.notes} | ${piece.sonorityRegions} | ${piece.tiedTopChordLabels} | ${piece.durationSeconds.toFixed(2)} | ${(100 * piece.profile.bestDiatonicCollection.share).toFixed(1)}% |`);
  lines.push("", "Pitch coverage is duration weighted, maximized over major-scale collections and their relative modes. It does not establish harmonic function or a tonic.", "",
    "## Controlled transformations", "", "| Score | Self summary | +5 summary | +5 inferred chord order | +5 measured order | Duration ×2 summary | Duration ×2 measured order | Reversed opening measured order |", "|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const control of report.controls) lines.push(`| ${names.get(control.sourceId)} | ${f(control.self.auditedSummaryDistance)} | ${f(control.transposedFiveSemitones.auditedSummaryDistance)} | ${order(control.transposedFiveSemitones.inferredChordOrder)} | ${order(control.transposedFiveSemitones.measuredSonorityOrder)} | ${f(control.globalDurationScaleTwo.auditedSummaryDistance)} | ${order(control.globalDurationScaleTwo.measuredSonorityOrder)} | ${order(control.reversedOpeningSonorities)} |`);
  lines.push("", "The +5 and duration ×2 controls rebuild the analysis from transformed canonical score events. Reversed openings reverse extracted measured tokens only; the source score is untouched.", "",
    "## Pair comparisons", "", "| Pair | Original summary | Audited summary | Inferred chord order (whole) | Measured order (whole) | Measured order (opening, ≤64 regions) |", "|---|---:|---:|---:|---:|---:|");
  for (const pair of report.comparisons) lines.push(`| ${names.get(pair.sourceA)} ↔ ${names.get(pair.sourceB)} | ${f(pair.originalSummaryDistance)} | ${f(pair.auditedSummaryDistance)} | ${order(pair.inferredChordOrder)} | ${order(pair.measuredSonorityOrder)} | ${order(pair.openingPassage.measuredOrder)} |`);
  lines.push("", "Every symbolic summary withholds the audio-only descriptive profile (7/8 summary components). Opening comparisons use the first sounding sonority regions of each file; these are separate scoped results, not whole-piece estimates or phrase matches.", "", "## Limits", "");
  for (const limit of report.limits) lines.push(`- ${limit}`);
  lines.push("", "## Source identity", "", "| Score | SHA-256 |", "|---|---|");
  for (const piece of report.pieces) lines.push(`| ${piece.name} | \`${piece.sha256}\` |`);
  return lines.join("\n") + "\n";
}

async function main() {
  const args = process.argv.slice(2), files = [];
  let jsonPath = null, markdownPath = null;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--json" || args[i] === "--markdown") {
      const flag = args[i], value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`${flag} requires an output path`);
      if (flag === "--json") jsonPath = value; else markdownPath = value;
    } else if (args[i].startsWith("--")) throw new Error(`Unknown option: ${args[i]}`);
    else files.push(args[i]);
  }
  if (!files.length) throw new Error("Usage: node scripts/audit-score-similarity.mjs [--json report.json] [--markdown report.md] score.musicxml [...]");
  const resolvedInputs = new Set(files.map((file) => path.resolve(file)));
  if ([jsonPath, markdownPath].filter(Boolean).some((output) => resolvedInputs.has(path.resolve(output))) ||
    (jsonPath && markdownPath && path.resolve(jsonPath) === path.resolve(markdownPath))) {
    throw new Error("Output paths must be distinct and cannot overwrite an input score");
  }
  const report = await auditScoreFiles(files, { onProgress: (message) => process.stderr.write(message + "\n") });
  const json = JSON.stringify(report, null, 2) + "\n";
  if (jsonPath) await fs.writeFile(jsonPath, json);
  if (markdownPath) await fs.writeFile(markdownPath, renderScoreAuditMarkdown(report));
  if (!jsonPath && !markdownPath) process.stdout.write(json);
  else process.stdout.write(JSON.stringify({ pieces: report.pieces.length, comparisons: report.comparisons.length,
    measuredControlFailures: report.controls.filter((control) => !control.checks.selfMeasuredOrder ||
      !control.checks.transposedMeasuredOrder || !control.checks.tempoScaledMeasuredOrder).length,
    inferredTranspositionFailures: report.controls.filter((control) => control.checks.transposedInferredChordOrder === false).length,
    inferredTranspositionUnavailable: report.controls.filter((control) => control.checks.transposedInferredChordOrder == null).length }) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { process.stderr.write(error.message + "\n"); process.exitCode = 1; });
}
