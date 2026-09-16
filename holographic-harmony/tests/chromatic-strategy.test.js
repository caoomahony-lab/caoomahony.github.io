import test from "node:test";
import assert from "node:assert/strict";
import { extractChromaticStrategy } from "../src/fingerprint/blocks/chromatic-strategy.js";

function e(pc,onset,duration=1) { return {pitchClass:pc,onsetSec:onset,durationSec:duration,endSec:onset+duration}; }

test("one repeated foreign pitch yields concentrated chromatic strategy", () => {
  const events = [e(0,0),e(4,0),e(7,0),e(1,1,.5),e(1,2,.5),e(1,3,.5)];
  const block = extractChromaticStrategy(events, { referenceField:[0,2,4,5,7,9,11], centerPc:0 });
  assert.equal(block.distinctOutsideFieldClasses, 1);
  assert.equal(block.outsideClassConcentration, 1);
  assert.equal(block.dominantForeignPc, 1);
  assert.equal(block.dominantForeignShare, 1);
});

test("distributed foreign pitches have lower concentration", () => {
  const events = [e(1,0),e(3,1),e(6,2),e(8,3),e(10,4)];
  const block = extractChromaticStrategy(events, { referenceField:[0,2,4,5,7,9,11] });
  assert.ok(block.outsideClassConcentration < 0.01);
  assert.equal(block.distinctOutsideFieldClasses, 5);
});

test("relative chromatic distribution is invariant under matched transposition", () => {
  const a = extractChromaticStrategy([e(1,0),e(1,1),e(8,2)], { referenceField:[0,2,4,5,7,9,11], centerPc:0 });
  const b = extractChromaticStrategy([e(6,0),e(6,1),e(1,2)], { referenceField:[5,7,9,10,0,2,4], centerPc:5 });
  assert.deepEqual(a.outsideRelativeDurationDistribution, b.outsideRelativeDurationDistribution);
  assert.equal(a.outsideClassConcentration, b.outsideClassConcentration);
});

test("foreign episodes can be measured relative to later center changes", () => {
  const block = extractChromaticStrategy([e(1,0,.2),e(1,.1,.2),e(3,5,.2)], {
    referenceField:[0,2,4,5,7,9,11], centerChangeTimes:[1,10], centerChangeLookaheadSec:2
  });
  assert.equal(block.foreignEpisodeCount, 2);
  assert.equal(block.centerChangePrecedenceRate, 0.5);
});
