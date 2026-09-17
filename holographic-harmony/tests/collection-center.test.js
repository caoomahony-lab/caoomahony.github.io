import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  collectionKey,
  inferCollectionCandidates,
  inferCollectionCenterState,
  selectStableCollection
} from "../src/inference/collection-center.js";

const FS_MAJOR_COLLECTION = [1, 3, 5, 6, 8, 10, 11];

function activity(entries) {
  const bins = Array(12).fill(0);
  for (const [pc, value] of entries) bins[pc] = value;
  return bins;
}

test("relative modes are grouped as center hypotheses of one pitch collection", () => {
  const bins = activity(FS_MAJOR_COLLECTION.map((pc) => [pc, 1]));
  const collections = inferCollectionCandidates(bins);
  const selected = collections[0];

  assert.equal(selected.key, collectionKey(FS_MAJOR_COLLECTION));
  assert.equal(selected.label, "F# / D# minor collection");
  assert.ok(selected.centers.some((candidate) => candidate.label === "F# Major"));
  assert.ok(selected.centers.some((candidate) => candidate.label === "D# Natural minor"));
  assert.ok(selected.centers.some((candidate) => candidate.label === "A# Phrygian"));
  assert.ok(selected.centers.every((candidate) => collectionKey(candidate.pcs) === selected.key));
});

test("changing modal emphasis inside the same notes does not manufacture a collection change", () => {
  const majorEmphasis = activity([
    [6, 7], [1, 5], [10, 3], [8, 2], [11, 2], [3, 1.5], [5, 1]
  ]);
  const minorPhrygianEmphasis = activity([
    [3, 7], [10, 6], [11, 4], [5, 3], [6, 2], [8, 2], [1, 1]
  ]);

  const first = inferCollectionCenterState(majorEmphasis, FS_MAJOR_COLLECTION).collection;
  const second = inferCollectionCenterState(minorPhrygianEmphasis, first.pcs).collection;
  assert.equal(first.key, collectionKey(FS_MAJOR_COLLECTION));
  assert.equal(second.key, first.key);
});

test("collection hysteresis retains a plausible previous set until a challenger is materially stronger", () => {
  const previous = Object.freeze({ key: "1,3,5,6,8,10,11", pcs: FS_MAJOR_COLLECTION, support: 0.72, centers: [] });
  const closeChallenger = Object.freeze({ key: "0,2,4,5,7,9,11", pcs: [0, 2, 4, 5, 7, 9, 11], support: 0.76, centers: [] });
  assert.equal(
    selectStableCollection([closeChallenger, previous], FS_MAJOR_COLLECTION, { switchMargin: 0.065, retainFloor: 0.52 }).key,
    previous.key
  );

  const strongChallenger = Object.freeze({ ...closeChallenger, support: 0.86 });
  assert.equal(
    selectStableCollection([strongChallenger, previous], FS_MAJOR_COLLECTION, { switchMargin: 0.065, retainFloor: 0.52 }).key,
    strongChallenger.key
  );
});

test("Harmonic Savant mounts the collection-aware visualizer", () => {
  const source = fs.readFileSync(new URL("../src/app/harmonic-savant-app.js", import.meta.url), "utf8");
  assert.match(source, /CollectionAwareHolographicHarmonyApp/);
  const collectionSource = fs.readFileSync(new URL("../src/app/collection-aware-app.js", import.meta.url), "utf8");
  assert.match(collectionSource, /CURRENT COLLECTION/);
  assert.match(collectionSource, /CENTER \/ MODE HYPOTHESES/);
});
