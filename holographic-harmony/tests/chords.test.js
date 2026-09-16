import test from "node:test";
import assert from "node:assert/strict";
import { exactChordMatches, rankChordCandidates, chordSymbol } from "../src/theory/chords.js";

test("exact triad and seventh chords are identified", () => {
  const c = exactChordMatches([0,4,7]);
  assert.ok(c.some((candidate) => candidate.rootPc === 0 && candidate.templateId === "major"));
  const dm7 = exactChordMatches([2,5,9,0]);
  assert.ok(dm7.some((candidate) => candidate.rootPc === 2 && candidate.templateId === "minor7"));
});

test("slash bass is preserved and inversion is described", () => {
  const matches = exactChordMatches([0,4,7], { bassPc: 4 });
  const c = matches.find((candidate) => candidate.rootPc === 0 && candidate.templateId === "major");
  assert.equal(c.symbol, "C/E");
  assert.equal(c.inversion, "first inversion");
});

test("symmetric chords preserve legitimate root ambiguity", () => {
  const matches = exactChordMatches([0,4,8]);
  const augRoots = matches.filter((candidate) => candidate.templateId === "augmented").map((candidate) => candidate.rootPc);
  assert.deepEqual(augRoots, [0,4,8]);
});

test("incomplete sonorities are ranked rather than forced", () => {
  const candidates = rankChordCandidates([0,4], { bassPc: 0, limit: 5 });
  assert.equal(candidates.length, 5);
  assert.ok(candidates[0].support > 0 && candidates[0].support < 1);
  assert.equal(candidates[0].exact, false);
});

test("chord symbol renderer supports flat spellings", () => {
  assert.equal(chordSymbol(1, "minor7", { preferFlats: true }), "Dbm7");
});
