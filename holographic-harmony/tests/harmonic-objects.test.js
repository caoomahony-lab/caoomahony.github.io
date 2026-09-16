import test from "node:test";
import assert from "node:assert/strict";
import { extractChordVocabulary } from "../src/fingerprint/blocks/chord-vocabulary.js";
import { analyzeHarmonicObjectSequence } from "../src/analysis/harmonic-objects.js";
import { renderFunction } from "../src/theory/functions.js";

test("chord vocabulary separates deterministic set classes from inferred templates", () => {
  const block = extractChordVocabulary([[0,4,7],[9,0,4],[5,9,0],[7,11,2]]);
  assert.equal(block.sonorityCount, 4);
  assert.ok(block.chordTemplateDistribution.major > 0);
  assert.ok(block.labeledWeightShare > 0.9);
  assert.equal(block.evidenceClass.setClasses, "deterministic");
  assert.equal(block.evidenceClass.chordTemplates, "inferred");
});

test("integrated harmonic-object analyzer exposes the HHF-2 layers together", () => {
  const result = analyzeHarmonicObjectSequence([[0,4,7],[9,0,4],[5,9,0],[7,11,2]]);
  const best = result.contextualFunction.hypotheses[0];
  assert.equal(best.centerPc, 0);
  assert.equal(best.systemId, "major");
  assert.deepEqual(best.functions.map((entry) => entry.candidates[0].roman), ["I","vi","IV","V"]);
  assert.equal(result.rootMotion.transitionCount, 3);
  assert.equal(result.chordTransitions.transitionCounts["I→vi"], 1);
  assert.ok(result.modalProfile.ambiguityMean >= 0);
});

test("functional sequence can be translated wholesale to another key", () => {
  const result = analyzeHarmonicObjectSequence([[0,4,7],[9,0,4],[5,9,0],[7,11,2]]);
  const functions = result.contextualFunction.hypotheses[0].functions.map((entry) => entry.candidates[0]);
  const inFSharp = functions.map((candidate) => renderFunction(candidate, { format:"key", targetTonic:"F#" }));
  assert.deepEqual(inFSharp, ["F#","D#m","B","C#"]);
});
