import test from "node:test";
import assert from "node:assert/strict";
import {
  consolidateHarmonicRegions,
  HARMONIC_REGION_VERSION
} from "../src/inference/harmonic-regions.js";

function chroma(pcs) {
  const values = Array(12).fill(0.01);
  for (const pc of pcs) values[pc] = 1;
  return values;
}

function segment(index, onset, end, {
  rootPc,
  templateId = "major",
  pcs,
  ambiguity = 0.2
}) {
  const symbol = `${rootPc}:${templateId}`;
  return Object.freeze({
    index,
    onset,
    end,
    duration: end - onset,
    symbol,
    rootPc,
    templateId,
    pcs,
    observedPitchClasses: pcs,
    chroma: chroma(pcs),
    ambiguity,
    candidates: Object.freeze([
      Object.freeze({ rootPc, templateId, symbol, relativeWeight: 0.8 })
    ]),
    bassPc: null,
    evidenceClass: "inferred-from-audio"
  });
}

test("compatible same-root micro-segments collapse into a coarser region", () => {
  const input = [
    segment(0, 0, 1, { rootPc: 0, templateId: "major", pcs: [0, 4, 7] }),
    segment(1, 1, 2, { rootPc: 0, templateId: "major7", pcs: [0, 4, 7, 11] })
  ];
  const result = consolidateHarmonicRegions(input);
  assert.equal(result.regionVersion, HARMONIC_REGION_VERSION);
  assert.equal(result.microSegmentCount, 2);
  assert.equal(result.regionCount, 1);
  assert.deepEqual(result.regions[0].constituentMicroSegmentIndices, [0, 1]);
  assert.equal(result.regions[0].provenance.rule, "conservative-compatible-consolidation");
});

test("a genuine C to G root change remains distinct", () => {
  const result = consolidateHarmonicRegions([
    segment(0, 0, 1, { rootPc: 0, pcs: [0, 4, 7] }),
    segment(1, 1, 2, { rootPc: 7, pcs: [2, 7, 11] })
  ]);
  assert.equal(result.regionCount, 2);
  assert.deepEqual(result.regions.map((region) => region.constituentMicroSegmentIndices), [[0], [1]]);
});

test("a short ambiguous bridge is absorbed only between compatible flanks", () => {
  const compatible = consolidateHarmonicRegions([
    segment(0, 0, 1, { rootPc: 0, pcs: [0, 4, 7] }),
    segment(1, 1, 1.25, { rootPc: 6, templateId: "diminished", pcs: [0, 6, 9], ambiguity: 0.9 }),
    segment(2, 1.25, 2.25, { rootPc: 0, templateId: "major7", pcs: [0, 4, 7, 11] })
  ]);
  assert.equal(compatible.regionCount, 1);
  assert.deepEqual(compatible.regions[0].constituentMicroSegmentIndices, [0, 1, 2]);
  assert.ok(compatible.regions[0].provenance.mergeReasons.some((reason) =>
    reason.reason === "short-ambiguous-bridge-between-compatible-flanks"
  ));

  const incompatible = consolidateHarmonicRegions([
    segment(0, 0, 1, { rootPc: 0, pcs: [0, 4, 7] }),
    segment(1, 1, 1.25, { rootPc: 6, templateId: "diminished", pcs: [0, 6, 9], ambiguity: 0.9 }),
    segment(2, 1.25, 2.25, { rootPc: 7, pcs: [2, 7, 11] })
  ]);
  assert.equal(incompatible.regionCount, 3);
});

test("distinct roots and collections are not smeared together", () => {
  const result = consolidateHarmonicRegions([
    segment(0, 0, 1, { rootPc: 0, pcs: [0, 4, 7] }),
    segment(1, 1, 2, { rootPc: 1, pcs: [1, 5, 8] }),
    segment(2, 2, 3, { rootPc: 6, templateId: "minor", pcs: [1, 6, 9] })
  ]);
  assert.equal(result.regionCount, 3);
});

test("region bass is duration-weighted and withheld when constituent evidence conflicts", () => {
  const left = { ...segment(0, 0, 2, { rootPc: 0, pcs: [0, 4, 7] }), bassPc: 0, bassConfidence: 0.9 };
  const right = { ...segment(1, 2, 3, { rootPc: 0, templateId: "major7", pcs: [0, 4, 7, 11] }), bassPc: 4, bassConfidence: 0.2 };
  const result = consolidateHarmonicRegions([left, right]);
  assert.equal(result.regionCount, 1);
  assert.equal(result.regions[0].bassPc, 0);
  assert.match(result.regions[0].bassEvidence, /low-frequency/);
});

test("every source micro-segment is represented exactly once without mutation", () => {
  const input = [
    segment(10, 0, 1, { rootPc: 0, pcs: [0, 4, 7] }),
    segment(11, 1, 2, { rootPc: 0, templateId: "major6", pcs: [0, 4, 7, 9] }),
    segment(12, 2, 3, { rootPc: 7, pcs: [2, 7, 11] })
  ];
  const snapshot = JSON.stringify(input);
  const result = consolidateHarmonicRegions(input);
  const represented = result.regions
    .flatMap((region) => region.constituentMicroSegmentIndices)
    .sort((a, b) => a - b);
  assert.deepEqual(represented, [10, 11, 12]);
  assert.equal(new Set(represented).size, input.length);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(result.microSegments[0], input[0]);
  assert.ok(result.regions.every((region) => region.bassPc === null));
  assert.ok(result.regions.every((region) => /probabilities/.test(result.note)));
});
