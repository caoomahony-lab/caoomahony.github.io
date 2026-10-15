import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { pathToFileURL } from "node:url";
import { prepareLocalScoreFile, SCORE_IO_VERSION } from "../src/music/score-io.js";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { deriveScoreComparison, compareScoreComparisons, projectScoreDistributionSummary, SCORE_COMPARISON_VERSION } from "../src/similarity/score-comparison.js";
import { REFERENCE_CATALOG_VERSION, validateReferenceCatalog } from "../src/corpus/reference-catalog.js";
import { transposeEvents } from "../src/theory/transposition.js";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const clean = value => ["", "na", "n/a", "nan", "none"].includes(String(value ?? "").trim().toLowerCase()) ? "" : String(value).trim();
const labels = value => [...new Set(clean(value).split("-").map(clean).filter(value => value && value.length <= 300))].sort();
const zero = comparison => Object.values(comparison.components).every(value => value == null || Math.abs(value) < 1e-12);

async function deriveRecord(record) {
  const bytes = await fs.readFile(record.localPath);
  if (sha(bytes) !== record.sha256) throw new Error("MXL source hash does not match acquisition manifest");
  const sourceId = `sha256:${record.sha256}`, started = performance.now();
  const prepared = await prepareLocalScoreFile({ name: "reference.mxl", arrayBuffer: async () => Uint8Array.from(bytes).buffer }, LiteDOMParser, { trackId: sourceId });
  const events = prepared.parsed.eventsV1, before = JSON.stringify(events);
  const descriptor = deriveScoreComparison(events, { sourceId, sourceFormat: "mxl" });
  if (descriptor.counts.regions < 4 || descriptor.counts.regions > 500 || descriptor.counts.attacks < 3 ||
      !descriptor.distributions.verticalIntervals.some(value => value > 0)) throw new Error("Outside pilot analysis bounds: require 4–500 regions, 3 attacks and polyphonic interval evidence");
  if (!zero(compareScoreComparisons(descriptor, descriptor))) throw new Error("Reference self-comparison failed");
  const doc = new LiteDOMParser().parseFromString(prepared.exportXml, "application/xml");
  const instruments = [...new Set(doc.getElementsByTagName("score-part").map(part => clean(part.getElementsByTagName("instrument-name")[0]?.textContent || part.getElementsByTagName("part-name")[0]?.textContent)).filter(value => value && value.length <= 300))].sort();
  const xmlComposer = doc.getElementsByTagName("creator").find(element => element.getAttribute("type") === "composer")?.textContent;
  const { foundationFingerprint: _foundation, ...scoreDescriptor } = descriptor;
  return { id: `pdmx:${record.sha256}`, title: clean(record.title) || clean(record.song_name) || clean(doc.getElementsByTagName("work-title")[0]?.textContent) || "Untitled PDMX score",
    composer: clean(record.composer_name) || clean(xmlComposer) || clean(record.artist_name), genres: labels(record.genres), tags: labels(record.tags), instruments,
    sha256: record.sha256, counts: descriptor.counts, durationSeconds: descriptor.durationSeconds,
    rights: { license: record.license, licenseConflict: false, licenseUrl: record.license_url },
    source: { archivePath: record.archivePath, metadataPath: record.metadata, recordDoi: "10.5281/zenodo.15571083" },
    provenance: { parserVersion: SCORE_IO_VERSION, eventSchemaVersion: 1, hirSchemaVersion: null, analysisVersion: SCORE_COMPARISON_VERSION,
      descriptorProjection: "All comparison fields retained; duplicate foundationFingerprint omitted", sourceFormat: "mxl" },
    summary: projectScoreDistributionSummary(descriptor), scoreDescriptor,
    verification: { deriveMilliseconds: performance.now() - started, self: true, eventsUnchanged: JSON.stringify(events) === before,
      bytesUnchanged: sha(await fs.readFile(record.localPath)) === record.sha256 } };
}

if (!isMainThread) {
  parentPort.on("message", async ({ index, record }) => {
    try { parentPort.postMessage({ index, result: await deriveRecord(record) }); }
    catch (error) { parentPort.postMessage({ index, error: error.message }); }
  });
}

async function derivePool(records, concurrency = 4) {
  const output = Array(records.length); let cursor = 0, complete = 0;
  const workers = Array.from({ length: Math.min(concurrency, records.length) }, () => new Worker(new URL(import.meta.url)));
  try {
    await Promise.all(workers.map(worker => new Promise((resolve, reject) => {
      const next = () => {
        if (cursor === records.length) { resolve(); return; }
        const index = cursor++; worker.postMessage({ index, record: records[index] });
      };
      worker.on("error", reject); worker.on("message", message => {
        output[message.index] = message; complete++;
        if (complete % 50 === 0) console.log(`Analyzed ${complete}/${records.length} reference scores`);
        next();
      }); next();
    })));
  } finally { await Promise.all(workers.map(worker => worker.terminate())); }
  return output;
}

export async function buildPdmxCatalog(selectionPath, outputDirectory, reportPath, { count = 500 } = {}) {
  const acquired = JSON.parse(await fs.readFile(selectionPath, "utf8"));
  if (acquired.source?.doi !== "10.5281/zenodo.15571083" || acquired.source.csvMd5 !== "30392ccf38bb63ce70e7afae70f9c88c" ||
      !Array.isArray(acquired.records) || acquired.records.length < count) throw new Error("Pinned PDMX selection is required");
  const outcomes = await derivePool(acquired.records);
  const hashes = new Set();
  const successful = outcomes.filter(outcome => outcome.result && !hashes.has(outcome.result.sha256) && hashes.add(outcome.result.sha256));
  const rejectionReasons = {};
  for (const outcome of outcomes.filter(item => item.error)) rejectionReasons[outcome.error] = (rejectionReasons[outcome.error] || 0) + 1;
  console.log("Analysis selection:", JSON.stringify({ acceptable: successful.length, rejectionReasons }));
  if (successful.length < count) throw new Error(`Only ${successful.length} acceptable references; need ${count}. Acquire more eligible files.`);
  const chosen = successful.slice(0, count).map(outcome => outcome.result);
  const catalogId = `pdmx-v9-pilot-${count}-v1`, records = [], shards = [];
  const output = path.resolve(outputDirectory), selectionDirectory = path.dirname(path.resolve(selectionPath));
  if (output === selectionDirectory || path.resolve(reportPath) === path.resolve(selectionPath)) throw new Error("Outputs must not overwrite acquired inputs");
  await fs.mkdir(path.join(output, "shards"), { recursive: true });
  for (let start = 0; start < chosen.length; start += 25) {
    const filename = `shards/pdmx-${String(start / 25).padStart(3, "0")}.json`, group = chosen.slice(start, start + 25);
    const text = JSON.stringify({ version: REFERENCE_CATALOG_VERSION, catalogId, records: group.map(item => ({ id: item.id, scoreDescriptor: item.scoreDescriptor })) }) + "\n";
    const hash = sha(text); await fs.writeFile(path.join(output, filename), text);
    shards.push({ path: filename, sha256: hash, bytes: Buffer.byteLength(text) });
    for (const { scoreDescriptor: _descriptor, verification: _verification, ...metadata } of group) records.push({ ...metadata, descriptorFile: filename, descriptorSha256: hash });
  }
  const manifest = { version: REFERENCE_CATALOG_VERSION, id: catalogId, analysisVersion: SCORE_COMPARISON_VERSION, count,
    source: { ...acquired.source, authors: ["Phillip Long", "Zachary Novack", "Julian McAuley", "Taylor Berg-Kirkpatrick"],
      selection: `${acquired.selection.policy}; require polyphonic evidence, 4–500 sounding regions and at least 3 attacks; first ${count} accepted unique source hashes`,
      limitation: "Bounded experimental score/arrangement pilot; metadata labels are not verified recordings or artist-style profiles. Full HIR and full Harmonic Fingerprint V1 are not claimed." }, records };
  if (!validateReferenceCatalog(manifest)) throw new Error("Generated catalog failed schema validation");
  await fs.writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest) + "\n");
  const controls = [];
  for (const index of Array.from({ length: Math.min(10, count) }, (_, i) => Math.floor(i * (count - 1) / 9))) {
    const item = chosen[index], record = acquired.records.find(record => record.sha256 === item.sha256);
    const bytes = await fs.readFile(record.localPath);
    const prepared = await prepareLocalScoreFile({ name: "reference.mxl", arrayBuffer: async () => Uint8Array.from(bytes).buffer }, LiteDOMParser);
    const events = prepared.parsed.eventsV1;
    const transposed = deriveScoreComparison(transposeEvents(events, 5), { sourceId: item.summary.sourceId + "@+5", sourceFormat: "mxl" });
    const slowed = deriveScoreComparison(events.map(event => ({ ...event, onsetSec: event.onsetSec * 2, durationSec: event.durationSec * 2, endSec: event.endSec * 2 })), { sourceId: item.summary.sourceId + "@time2", sourceFormat: "mxl" });
    controls.push({ id: item.id, title: item.title, transposition: zero(compareScoreComparisons(item.scoreDescriptor, transposed)),
      uniformTempo: zero(compareScoreComparisons(item.scoreDescriptor, slowed)), bytesUnchanged: sha(await fs.readFile(record.localPath)) === item.sha256 });
  }
  const report = { version: "reference-catalog-build-report-v1", catalogId, source: manifest.source,
    summary: { acquired: acquired.records.length, successfullyAnalyzed: successful.length, published: count,
      rejected: outcomes.filter(outcome => outcome.error).length, selfChecksPassed: chosen.filter(item => item.verification.self).length,
      unchangedSources: chosen.every(item => item.verification.bytesUnchanged && item.verification.eventsUnchanged),
      failedTransformationControls: controls.filter(control => !control.transposition || !control.uniformTempo || !control.bytesUnchanged).length,
      manifestBytes: (await fs.stat(path.join(output, "manifest.json"))).size, shardBytes: shards.reduce((sum, shard) => sum + shard.bytes, 0),
      maxDeriveMilliseconds: Math.max(...chosen.map(item => item.verification.deriveMilliseconds)) }, shards, controls,
    rejected: outcomes.filter(outcome => outcome.error).map(outcome => ({ sourceHash: acquired.records[outcome.index].sha256, reason: outcome.error })) };
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  if (report.summary.failedTransformationControls || !report.summary.unchangedSources) throw new Error("Catalog transformation/source controls failed; do not release these outputs");
  console.log(JSON.stringify(report.summary)); return report;
}

if (isMainThread && process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [selection, output, report] = process.argv.slice(2);
  if (!selection || !output || !report || process.argv.length !== 5) { console.error("Usage: node scripts/build-pdmx-catalog.mjs selection.json output-directory report.json"); process.exitCode = 2; }
  else await buildPdmxCatalog(selection, output, report);
}
