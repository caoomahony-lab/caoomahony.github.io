import test from "node:test";
import assert from "node:assert/strict";
import { generateContinuationCandidates } from "../src/continuation/candidate-generator.js";

const C_MAJOR_CONTEXT = {
  centerPc: 0,
  systemId: "major",
  currentChord: { rootPc: 0, templateId: "major" }
};

function findChord(result, rootPc, templateId) {
  return result.candidates.find((candidate) => candidate.rootPc === rootPc && candidate.templateId === templateId);
}

test("candidate generator includes diatonic triads and sevenths without ranking them", () => {
  const result = generateContinuationCandidates(C_MAJOR_CONTEXT, {
    secondaryDominants: false,
    modalMixture: false,
    chromaticMediants: false,
    holographicShadow: false
  });
  assert.ok(findChord(result, 0, "major"));
  assert.ok(findChord(result, 9, "minor"));
  assert.ok(findChord(result, 7, "dominant7"));
  assert.ok(result.candidates.every((candidate) => !("score" in candidate) && !("rank" in candidate)));
  assert.ok(findChord(result, 0, "major").sources.includes("diatonic"));
});

test("secondary dominants identify their diatonic targets", () => {
  const result = generateContinuationCandidates(C_MAJOR_CONTEXT, {
    modalMixture: false,
    chromaticMediants: false,
    holographicShadow: false
  });
  const d7 = findChord(result, 2, "dominant7");
  assert.ok(d7);
  assert.ok(d7.sources.includes("secondary-dominant"));
  assert.equal(d7.metadata.targetRootPc, 7);
  assert.equal(d7.metadata.targetDegreeNumber, 5);
});

test("parallel modal mixture produces borrowed minor-mode triads", () => {
  const result = generateContinuationCandidates(C_MAJOR_CONTEXT, {
    secondaryDominants: false,
    chromaticMediants: false,
    holographicShadow: false
  });
  const borrowedIv = findChord(result, 5, "minor");
  assert.ok(borrowedIv);
  assert.ok(borrowedIv.sources.includes("modal-mixture"));
});

test("chromatic mediants are generated relative to the current root", () => {
  const result = generateContinuationCandidates(C_MAJOR_CONTEXT, {
    diatonic: false,
    secondaryDominants: false,
    modalMixture: false,
    holographicShadow: false
  });
  assert.ok(findChord(result, 3, "major"));
  assert.ok(findChord(result, 4, "minor"));
  assert.ok(findChord(result, 8, "major"));
  assert.ok(findChord(result, 9, "minor"));
  assert.ok(result.candidates.every((candidate) => candidate.sources.includes("chromatic-mediant")));
});

test("Holographic candidates explicitly identify shadow admissions", () => {
  const result = generateContinuationCandidates({
    centerPc: 11,
    systemId: "lydian",
    currentChord: { rootPc: 11, templateId: "major" },
    activeField: [11, 1, 3, 5, 6, 8, 10],
    shadowField: [0, 2, 4, 7, 9]
  }, {
    diatonic: false,
    secondaryDominants: false,
    modalMixture: false,
    chromaticMediants: false
  });
  assert.ok(result.candidates.length > 0);
  assert.ok(result.candidates.every((candidate) => candidate.sources.includes("holographic-shadow")));
  assert.ok(result.candidates.every((candidate) => candidate.metadata.admittedShadowPitchClasses.length >= 1));
  assert.ok(result.candidates.every((candidate) => candidate.metadata.activeOverlapPitchClasses.length >= 2));
});

test("external style/corpus evidence merges provenance instead of duplicating a chord", () => {
  const result = generateContinuationCandidates({
    ...C_MAJOR_CONTEXT,
    externalCandidates: [
      { id: "style-g", rootPc: 7, templateId: "major", source: "user-style", explanation: "observed in personal corpus" },
      { id: "corpus-g", rootPc: 7, templateId: "major", source: "corpus-observed" }
    ]
  }, {
    secondaryDominants: false,
    modalMixture: false,
    chromaticMediants: false,
    holographicShadow: false
  });
  const g = findChord(result, 7, "major");
  assert.ok(g);
  assert.ok(g.sources.includes("diatonic"));
  assert.ok(g.sources.includes("user-style"));
  assert.ok(g.sources.includes("corpus-observed"));
  assert.equal(result.candidates.filter((candidate) => candidate.rootPc === 7 && candidate.templateId === "major").length, 1);
});

test("candidate generation is deterministic and hard-bounded", () => {
  const options = { maxCandidates: 12 };
  const first = generateContinuationCandidates(C_MAJOR_CONTEXT, options);
  const second = generateContinuationCandidates(C_MAJOR_CONTEXT, options);
  assert.equal(first.returnedCount, 12);
  assert.equal(first.truncated, true);
  assert.deepEqual(first, second);
});

test("invalid systems and external sources fail closed", () => {
  assert.throws(() => generateContinuationCandidates({ centerPc: 0, systemId: "nope" }), /Unknown systemId/);
  assert.throws(() => generateContinuationCandidates({
    ...C_MAJOR_CONTEXT,
    externalCandidates: [{ rootPc: 0, templateId: "major", source: "mystery" }]
  }), /Unsupported external candidate source/);
});
