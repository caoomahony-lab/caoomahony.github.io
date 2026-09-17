import test from "node:test";
import assert from "node:assert/strict";
import { generateContinuationCandidates } from "../src/continuation/candidate-generator.js";
import { scoreContinuationCandidate } from "../src/continuation/score-candidate.js";
import { scoreNoveltyContinuation } from "../src/continuation/scores/novelty-score.js";
import { scoreFunctionalContinuation } from "../src/continuation/scores/function-score.js";
import { continuationCandidateKey } from "../src/continuation/scores/evidence-score.js";

function candidate(rootPc, templateId, pitchClasses) {
  return { rootPc, templateId, pitchClasses, symbol: null, sources: ["test"] };
}

const C = candidate(0, "major", [0, 4, 7]);
const G = candidate(7, "major", [2, 7, 11]);

test("functional and novelty objectives remain independent", () => {
  const functionalG = scoreFunctionalContinuation(G, { centerPc: 0, systemId: "major", currentFunctionRole: "predominant" });
  const functionalC = scoreFunctionalContinuation(C, { centerPc: 0, systemId: "major", currentFunctionRole: "predominant" });
  assert.ok(functionalG.available && functionalC.available);
  assert.ok(functionalG.transitionSupport > functionalC.transitionSupport);

  const noveltyG = scoreNoveltyContinuation(G, { recentChords: [[0, 4, 7]] });
  const noveltyC = scoreNoveltyContinuation(C, { recentChords: [[0, 4, 7]] });
  assert.ok(noveltyG.score > noveltyC.score);
});

test("HHF-020 returns all dimensions without inventing a combined score", () => {
  const key = continuationCandidateKey(G);
  const scored = scoreContinuationCandidate(G, {
    centerPc: 0,
    systemId: "major",
    currentFunctionRole: "predominant",
    currentVoicing: [48, 55, 60, 64],
    recentChords: [[0, 4, 7]],
    activeField: [0, 2, 4, 5, 7, 9, 11],
    shadowField: [1, 3, 6, 8, 10],
    corpusEvidence: { [key]: { count: 30, total: 100, provenance: "fixture" } },
    styleEvidence: { [key]: { score: 0.82, modelId: "fixture-style", provenance: "fixture" } }
  }, {
    voiceLeading: { maxVoicingCandidates: 200 }
  });
  assert.equal(scored.combinedScore, null);
  assert.deepEqual(scored.unavailableDimensions, []);
  assert.ok(scored.dimensions.functional.score >= 0 && scored.dimensions.functional.score <= 1);
  assert.ok(scored.dimensions.voiceLeading.score >= 0 && scored.dimensions.voiceLeading.score <= 1);
  assert.equal(scored.dimensions.corpusFrequency.score, 0.3);
  assert.equal(scored.dimensions.styleSimilarity.score, 0.82);
  assert.ok(scored.dimensions.novelty.score > 0);
  assert.ok(scored.dimensions.holographicContinuity.score >= 0 && scored.dimensions.holographicContinuity.score <= 1);
  assert.ok(scored.dimensions.voiceLeading.bestVoicing.length === 4);
});

test("missing corpus/style/voicing/Holographic evidence remains explicitly unavailable", () => {
  const scored = scoreContinuationCandidate(G, {
    centerPc: 0,
    systemId: "major",
    recentChords: [[0, 4, 7]]
  });
  assert.equal(scored.dimensions.functional.available, true);
  assert.equal(scored.dimensions.novelty.available, true);
  assert.equal(scored.dimensions.voiceLeading.available, false);
  assert.equal(scored.dimensions.corpusFrequency.available, false);
  assert.equal(scored.dimensions.styleSimilarity.available, false);
  assert.equal(scored.dimensions.holographicContinuity.available, false);
});

test("voice-leading score uses a bounded set of legal realizations", () => {
  const scored = scoreContinuationCandidate(G, {
    centerPc: 0,
    systemId: "major",
    currentVoicing: [48, 55, 60, 64],
    recentChords: [[0, 4, 7]]
  }, {
    voiceLeading: {
      midiRange: [43, 76],
      maxVoicingCandidates: 120,
      maxSearchNodes: 10000
    }
  });
  assert.equal(scored.dimensions.voiceLeading.available, true);
  assert.ok(scored.dimensions.voiceLeading.candidateVoicingCount <= 120);
  assert.ok(Number.isFinite(scored.dimensions.voiceLeading.objectiveCost));
});

test("generated candidates can flow directly into HHF-020 scoring", () => {
  const generated = generateContinuationCandidates({
    centerPc: 0,
    systemId: "major",
    currentChord: { rootPc: 0, templateId: "major" }
  }, {
    maxCandidates: 10,
    holographicShadow: false
  });
  const scores = generated.candidates.map((item) => scoreContinuationCandidate(item, {
    centerPc: 0,
    systemId: "major",
    recentChords: [[0, 4, 7]]
  }));
  assert.equal(scores.length, 10);
  assert.ok(scores.every((entry) => entry.dimensions.functional.available));
  assert.ok(scores.every((entry) => entry.combinedScore === null));
});
