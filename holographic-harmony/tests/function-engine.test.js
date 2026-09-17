import test from "node:test";
import assert from "node:assert/strict";
import { rankChordCandidates } from "../src/theory/chords.js";
import { interpretChordUnderSystem, interpretChordSequence } from "../src/inference/function-engine.js";
import { renderFunction, spellRelativeDegree } from "../src/theory/functions.js";

test("a C major triad under C major renders I / 1 and tonic role", () => {
  const chord = rankChordCandidates([0,4,7], { bassPc: 0, limit: 1 })[0];
  const fn = interpretChordUnderSystem(chord, { centerPc: 0, systemId: "major", systemSupport: 0.9 });
  assert.equal(fn.roman, "I");
  assert.equal(fn.nashville, "1");
  assert.equal(fn.role, "tonic");
});

test("V7 is recognized functionally without hard-coding absolute key", () => {
  const chord = rankChordCandidates([7,11,2,5], { bassPc: 7, limit: 1 })[0];
  const fn = interpretChordUnderSystem(chord, { centerPc: 0, systemId: "major", systemSupport: 0.9 });
  assert.equal(fn.roman, "V7");
  assert.equal(fn.role, "dominant");
  assert.equal(renderFunction(fn, { format: "key", targetTonic: "F#" }), "C#7");
});

test("functional language translates to difficult target keys by degree spelling", () => {
  assert.equal(spellRelativeDegree("F#", 5), "B");
  assert.equal(spellRelativeDegree("Eb", 10), "Db");
  assert.equal(spellRelativeDegree("C", 1), "Db");
});

test("I-vi-IV-V sequence returns multiple contextual hypotheses", () => {
  const analysis = interpretChordSequence([[0,4,7],[9,0,4],[5,9,0],[7,11,2]], { hypothesisLimit: 5 });
  assert.equal(analysis.hypotheses.length, 5);
  assert.equal(analysis.hypotheses[0].centerPc, 0);
  assert.equal(analysis.hypotheses[0].systemId, "major");
  const romans = analysis.hypotheses[0].functions.map((entry) => entry.candidates[0].roman);
  assert.deepEqual(romans, ["I", "vi", "IV", "V"]);
  assert.ok(analysis.hypotheses[1].relativeWeight > 0);
});

test("sequence syntax prevents pitch-activity bias from promoting E Phrygian over C/A contexts", () => {
  const analysis = interpretChordSequence([
    { pcs: [0,4,7,11], bassPc: 0 },
    { pcs: [4,8,11,2], bassPc: 8 },
    { pcs: [9,0,4,7,11], bassPc: 9 },
    { pcs: [5,9,0,4], bassPc: 5 }
  ], { hypothesisLimit: 12 });

  const top = analysis.hypotheses[0];
  assert.ok([0,9].includes(top.centerPc), `expected C- or A-centered context, got ${top.centerPc} ${top.systemId}`);
  const ePhrygian = analysis.hypotheses.find((item) => item.centerPc === 4 && item.systemId === "phrygian");
  assert.ok(ePhrygian, "E Phrygian should remain available as a competing hypothesis rather than being deleted");
  assert.ok(top.support > ePhrygian.support);
  assert.ok(top.syntaxSupport > ePhrygian.syntaxSupport);
  assert.equal(top.syntaxEvidence.evidenceClass, "inferred-syntactic");
});

test("beginner rendering simplifies language without changing function", () => {
  const chord = rankChordCandidates([7,11,2], { limit: 1 })[0];
  const fn = interpretChordUnderSystem(chord, { centerPc: 0, systemId: "major", systemSupport: 0.8 });
  const text = renderFunction(fn, { format: "beginner" });
  assert.match(text, /strong pull toward a tonal center/);
  assert.match(text, /scale degree 5/);
});
