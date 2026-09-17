import test from "node:test";
import assert from "node:assert/strict";
import { rankContinuationCandidates, resolveContinuationWeights, CONTINUATION_WEIGHT_PRESETS } from "../src/continuation/rank.js";
import { generateContinuationCandidates } from "../src/continuation/candidate-generator.js";
import { scoreContinuationCandidates } from "../src/continuation/score-candidate.js";

const dims = (values) => Object.fromEntries([
  "functional", "voiceLeading", "corpusFrequency", "styleSimilarity", "novelty", "holographicContinuity"
].map((name) => [name, values[name] == null
  ? { available: false, score: null }
  : { available: true, score: values[name] }
]));

function scored(rootPc, templateId, values) {
  return {
    candidate: { rootPc, templateId, pitchClasses: [rootPc % 12] },
    dimensions: dims(values)
  };
}

test("weighted ranking uses exact requested arithmetic", () => {
  const a = scored(0, "major", { functional: 0.9, novelty: 0.2 });
  const b = scored(7, "major", { functional: 0.5, novelty: 0.9 });
  const result = rankContinuationCandidates([a, b], {
    weights: { functional: 3, novelty: 1 },
    missingPolicy: "renormalize"
  });
  assert.equal(result.rankings[0].candidate.rootPc, 0);
  assert.ok(Math.abs(result.rankings[0].combinedScore - 0.725) < 1e-12);
  assert.equal(result.rankings[0].contributions.functional.effectiveWeight, 0.75);
  assert.equal(result.rankings[0].contributions.novelty.effectiveWeight, 0.25);
});

test("changing user weights intentionally changes ordering", () => {
  const functionFavored = scored(0, "major", { functional: 0.95, voiceLeading: 0.2 });
  const smoothFavored = scored(7, "major", { functional: 0.4, voiceLeading: 0.95 });
  const functional = rankContinuationCandidates([functionFavored, smoothFavored], {
    weights: { functional: 5, voiceLeading: 1 }
  });
  const smooth = rankContinuationCandidates([functionFavored, smoothFavored], {
    weights: { functional: 1, voiceLeading: 5 }
  });
  assert.equal(functional.rankings[0].candidate.rootPc, 0);
  assert.equal(smooth.rankings[0].candidate.rootPc, 7);
});

test("missing-data policies renormalize, zero-fill, or exclude explicitly", () => {
  const complete = scored(0, "major", { functional: 0.6, styleSimilarity: 0.6 });
  const partial = scored(7, "major", { functional: 0.9 });
  const weights = { functional: 1, styleSimilarity: 1 };

  const renormalize = rankContinuationCandidates([complete, partial], { weights, missingPolicy: "renormalize" });
  assert.equal(renormalize.rankings[0].candidate.rootPc, 7);
  assert.equal(renormalize.rankings[0].combinedScore, 0.9);
  assert.deepEqual(renormalize.rankings[0].missingWeightedDimensions, ["styleSimilarity"]);

  const zero = rankContinuationCandidates([complete, partial], { weights, missingPolicy: "zero" });
  assert.equal(zero.rankings[0].candidate.rootPc, 0);
  assert.equal(zero.rankings.find((item) => item.candidate.rootPc === 7).combinedScore, 0.45);

  const require = rankContinuationCandidates([complete, partial], { weights, missingPolicy: "require" });
  assert.equal(require.eligibleCount, 1);
  assert.equal(require.rankings[0].candidate.rootPc, 0);
  assert.equal(require.excluded.length, 1);
});

test("ranker has no hidden default and rejects invalid weights", () => {
  const entry = scored(0, "major", { functional: 0.5 });
  assert.throws(() => rankContinuationCandidates([entry]), /explicit weights or a named preset/);
  assert.throws(() => rankContinuationCandidates([entry], { weights: { functional: -1 } }), /nonnegative/);
  assert.throws(() => rankContinuationCandidates([entry], { weights: { madeUp: 1 } }), /Unknown continuation weight dimension/);
  assert.throws(() => rankContinuationCandidates([entry], { weights: { functional: 0 } }), /at least one/);
  assert.throws(() => rankContinuationCandidates([entry], { preset: "nope" }), /Unknown continuation weight preset/);
  assert.throws(() => rankContinuationCandidates([entry], { weights: { functional: 1 }, preset: "balanced" }), /either weights or preset/);
});

test("named presets are explicit, inspectable weight sets", () => {
  assert.ok(CONTINUATION_WEIGHT_PRESETS.balanced);
  const resolved = resolveContinuationWeights({ preset: "voice-leading" });
  assert.equal(resolved.preset, "voice-leading");
  assert.equal(resolved.weights.voiceLeading, 4);
  assert.equal(resolved.weights.functional, 1);
});

test("ties use deterministic harmonic-object keys", () => {
  const g = scored(7, "major", { functional: 0.5 });
  const c = scored(0, "major", { functional: 0.5 });
  const result = rankContinuationCandidates([g, c], { weights: { functional: 1 } });
  assert.equal(result.rankings[0].candidate.rootPc, 0);
  assert.equal(result.rankings[1].candidate.rootPc, 7);
});

test("ranking does not mutate HHF-020 scored objects", () => {
  const entry = scored(0, "major", { functional: 0.8, novelty: 0.4 });
  const snapshot = JSON.stringify(entry);
  rankContinuationCandidates([entry], { weights: { functional: 1, novelty: 1 } });
  assert.equal(JSON.stringify(entry), snapshot);
});

test("HHF-019 -> HHF-020 -> HHF-021 works end to end", () => {
  const generated = generateContinuationCandidates({
    centerPc: 0,
    systemId: "major",
    currentChord: { rootPc: 0, templateId: "major" }
  }, {
    maxCandidates: 8,
    holographicShadow: false
  });
  const scoredCandidates = scoreContinuationCandidates(generated.candidates, {
    centerPc: 0,
    systemId: "major",
    currentFunctionRole: "tonic",
    recentChords: [[0, 4, 7]]
  });
  const ranked = rankContinuationCandidates(scoredCandidates, {
    weights: { functional: 2, novelty: 1 },
    missingPolicy: "renormalize"
  });
  assert.equal(ranked.returnedCount, 8);
  assert.ok(ranked.rankings.every((item, index) => item.rank === index + 1));
  assert.ok(ranked.rankings.every((item) => item.note.includes("not probability")));
});
