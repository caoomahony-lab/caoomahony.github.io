import test from "node:test";
import assert from "node:assert/strict";
import {
  EVIDENCE_AWARE_VERSION, deriveEvidenceAwareDescriptor, compareEvidenceAwareDescriptors,
  orderedHarmonyDistance, evidenceAwareCorpusPercentile
} from "../src/similarity/evidence-aware-distance.js";
import { derivePairwiseDescriptor, comparePairwiseDescriptors } from "../src/similarity/pairwise-distance.js";
import { deriveAudioFingerprint } from "../src/app/fingerprint-explorer.js";

const features = { motion: .5, recurrence: .4, center: .7, collection: .8, diversity: .6, activity: .5 };
function input(roots = [0, 2, 4, 0, 7, 11, 0], { transpose = 0, tempo = 1 } = {}) {
  const registeredNoteEvents = [], overallChroma = Array(12).fill(0);
  roots.forEach((root, i) => {
    // The held top C is intentionally unchanged when lower chord order changes.
    for (const midi of [48 + root, 52 + root, 55 + root, 84]) {
      registeredNoteEvents.push({ midi: midi + transpose, onset: i * tempo, duration: .9 * tempo });
      overallChroma[(midi + transpose) % 12]++;
    }
  });
  return {
    analysis: { registeredNoteEvents, overallChroma },
    harmony: { regions: roots.map((root, i) => ({ rootPc: (root + transpose) % 12, templateId: "major", onset: i * tempo, duration: tempo })) },
    fingerprintFeatures: features
  };
}
const audit = (roots, options) => deriveEvidenceAwareDescriptor(input(roots, options));

test("missing evidence is unavailable rather than a matching zero state", () => {
  const empty = deriveEvidenceAwareDescriptor();
  const result = compareEvidenceAwareDescriptors(empty, empty);
  assert.equal(result.distance, null);
  assert.equal(result.reason, "NO_SHARED_EVIDENCE");
  assert.deepEqual(result.families, { material: null, structural: null, stylistic: null });
  assert.equal(result.coverage.available.length, 0);
});

test("one-sided evidence is not treated as a musical mismatch or match", () => {
  const result = compareEvidenceAwareDescriptors(audit(), deriveEvidenceAwareDescriptor());
  assert.equal(result.distance, null);
  for (const value of Object.values(result.components)) assert.equal(value, null);
});

test("measured zero intervals and zero profile values remain usable evidence", () => {
  const source = input();
  source.fingerprintFeatures = Object.fromEntries(Object.keys(features).map((key) => [key, 0]));
  const descriptor = deriveEvidenceAwareDescriptor(source), result = compareEvidenceAwareDescriptors(descriptor, descriptor);
  assert.equal(result.distance, 0);
  assert.equal(descriptor.availability.interval, true);
  assert.equal(descriptor.availability.profile, true);
  assert.equal(result.coverage.available.length, 8);
});

test("fully supported summaries preserve the original metric and weights", () => {
  const a = input([0, 2, 4, 0, 7, 11, 0, 5, 0]);
  const b = input([0, 7, 11, 0, 2, 4, 0, 5, 0]);
  const result = compareEvidenceAwareDescriptors(deriveEvidenceAwareDescriptor(a), deriveEvidenceAwareDescriptor(b));
  const original = comparePairwiseDescriptors(derivePairwiseDescriptor(a), derivePairwiseDescriptor(b));
  assert.deepEqual(result.components, original.components);
  assert.equal(result.distance, original.distance);
});

test("unsupported recurrence lags do not dilute differences with matching zeros", () => {
  const repeated = audit([0, 0]), changed = audit([0, 2]);
  const result = compareEvidenceAwareDescriptors(repeated, changed);
  assert.equal(result.coverage.recurrenceLags, 1);
  assert.equal(result.components.recurrence, 1);
  assert.equal(result.original.components.recurrence, 1 / 8);
});

test("transposition and global tempo scaling preserve the audited musical pattern", () => {
  const result = compareEvidenceAwareDescriptors(audit(), audit(undefined, { transpose: 4, tempo: 2 }));
  assert.ok(Math.abs(result.distance) < 1e-12);
  assert.equal(result.orderedHarmony.distance, 0);
  assert.equal(result.orderedHarmony.shiftBToA, 8);
});

test("changed ordering is exposed even when every original summary matches", () => {
  const result = compareEvidenceAwareDescriptors(audit(), audit([0, 7, 11, 0, 2, 4, 0]));
  assert.equal(result.original.distance, 0);
  assert.equal(result.distance, 0); // Order is deliberately not given an arbitrary composite weight.
  assert.equal(result.orderedHarmony.edits, 4);
  assert.equal(result.orderedHarmony.distance, 4 / 7);
});

test("summary and ordered distances are symmetric and bounded", () => {
  const a = audit(), b = audit([0, 1, 8, 2, 11]);
  const ab = compareEvidenceAwareDescriptors(a, b), ba = compareEvidenceAwareDescriptors(b, a);
  assert.equal(ab.distance, ba.distance);
  assert.equal(ab.orderedHarmony.distance, ba.orderedHarmony.distance);
  for (const value of Object.values(ab.components)) if (value != null) assert.ok(value >= 0 && value <= 1);
});

test("unknown chord labels do not become ordered harmony or recurrence evidence", () => {
  const source = input();
  source.harmony.regions[3].rootPc = null;
  const descriptor = deriveEvidenceAwareDescriptor(source);
  const result = compareEvidenceAwareDescriptors(descriptor, descriptor);
  assert.equal(descriptor.sequence, null);
  assert.equal(result.components.harmonic, null);
  assert.equal(result.components.recurrence, null);
  assert.equal(result.orderedHarmony.distance, null);
});

test("unknown region timing is not manufactured from array order", () => {
  const source = input();
  delete source.harmony.regions[2].onset;
  const descriptor = deriveEvidenceAwareDescriptor(source);
  assert.equal(descriptor.sequence, null);
  assert.equal(descriptor.availability.harmonic, false);
  assert.equal(descriptor.availability.duration, false);
});

test("null, missing, out-of-range and nonnumeric registered notes are rejected", () => {
  const source = input();
  source.analysis.registeredNoteEvents.push({ midi: null, onset: 0 }, { midi: 128, onset: 0 }, {}, { midi: "60", onset: 0 });
  const descriptor = deriveEvidenceAwareDescriptor(source);
  assert.equal(descriptor.counts.rejectedNotes, 4);
  assert.equal(descriptor.counts.registeredNotes, 7);
});

test("old descriptors require re-analysis instead of silent reinterpretation", () => {
  const old = derivePairwiseDescriptor(input());
  assert.equal(compareEvidenceAwareDescriptors(audit(), old).reason, "REANALYSIS_REQUIRED");
  assert.equal(compareEvidenceAwareDescriptors(audit(), old).distance, null);
});

test("corpus percentiles use only pairs with the same available evidence", () => {
  const full = Array.from({ length: 5 }, (_, transpose) => audit(undefined, { transpose }));
  const styleOnly = deriveEvidenceAwareDescriptor({ analysis: { overallChroma: Array(12).fill(1) }, fingerprintFeatures: features });
  const comparison = compareEvidenceAwareDescriptors(full[0], full[1]);
  assert.equal(evidenceAwareCorpusPercentile(comparison, [full[0], full[1], ...Array(4).fill(styleOnly)]), null);
  const result = evidenceAwareCorpusPercentile(comparison, [...full, styleOnly]);
  assert.equal(result.pairCount, 10);
  assert.equal(result.supportSignature, comparison.supportSignature);
  assert.equal(result.percentile, 50);
});

test("long nonmatching sequences are marked unsupported rather than truncated", () => {
  const a = Array.from({ length: 501 }, () => ({ rootPc: 0, family: "major" }));
  const b = a.map((token, i) => ({ ...token, rootPc: i % 2 }));
  const result = orderedHarmonyDistance(a, b);
  assert.equal(result.reason, "COMPUTE_LIMIT");
  assert.equal(result.distance, null);
  assert.equal(orderedHarmonyDistance(a, a).distance, 0);
});

test("descriptors are deterministic and immutable without mutating input", () => {
  const source = input(), before = JSON.stringify(source);
  const a = deriveEvidenceAwareDescriptor(source), b = deriveEvidenceAwareDescriptor(source);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(source), before);
  assert.equal(Object.isFrozen(a.sequence[0]), true);
  assert.equal(a.version, EVIDENCE_AWARE_VERSION);
});

test("audio-derived fallback bars are not treated as six measured profile dimensions", () => {
  const fingerprint = deriveAudioFingerprint({ title: "empty" });
  assert.equal(fingerprint.auditDescriptor.availability.profile, false);
  assert.equal(compareEvidenceAwareDescriptors(fingerprint.auditDescriptor, fingerprint.auditDescriptor).distance, null);
  assert.ok(fingerprint.descriptor); // Original comparison remains available.
});
