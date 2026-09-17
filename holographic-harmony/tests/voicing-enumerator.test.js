import test from "node:test";
import assert from "node:assert/strict";
import { enumerateVoicings, rankVoicingsByVoiceLeading } from "../src/continuation/voicing-enumerator.js";

const C_MAJOR = { rootPc: 0, templateId: "major" };

test("voicing enumerator realizes a chord as registered MIDI without losing chord identity", () => {
  const voicings = enumerateVoicings(C_MAJOR, {
    midiRange: [48, 72],
    voiceCount: 4,
    maxSpan: 19,
    maxAdjacentSpacing: 12,
    maxCandidates: 500
  });
  assert.ok(voicings.length > 0);
  for (const voicing of voicings) {
    assert.equal(voicing.midi.length, 4);
    assert.deepEqual([...new Set(voicing.pitchClasses)].sort((a, b) => a - b), [0, 4, 7]);
    assert.ok(voicing.span <= 19);
    assert.ok(voicing.adjacentSpacings.every((spacing) => spacing <= 12));
  }
  assert.ok(voicings.some((voicing) => voicing.doublings.length > 0));
});

test("fixed bass and soprano constraints are enforced", () => {
  const voicings = enumerateVoicings(C_MAJOR, {
    midiRange: [48, 76],
    voiceCount: 4,
    fixedBassPc: 4,
    fixedSopranoPc: 7,
    maxCandidates: 500
  });
  assert.ok(voicings.length > 0);
  assert.ok(voicings.every((voicing) => voicing.bassPc === 4 && voicing.sopranoPc === 7));
});

test("disabling doubling makes overcomplete voice counts impossible", () => {
  const voicings = enumerateVoicings(C_MAJOR, {
    midiRange: [48, 84],
    voiceCount: 4,
    allowDoubling: false
  });
  assert.equal(voicings.length, 0);
});

test("extended-chord omission policy permits fifth omission but keeps non-omittable tones", () => {
  const voicings = enumerateVoicings({ rootPc: 0, templateId: "dominant9" }, {
    midiRange: [48, 84],
    voiceCount: 4,
    omissionPolicy: "extended",
    allowDoubling: false,
    maxCandidates: 500
  });
  assert.ok(voicings.length > 0);
  assert.ok(voicings.every((voicing) => voicing.pitchClasses.includes(0)));
  assert.ok(voicings.every((voicing) => voicing.pitchClasses.includes(2)));
  assert.ok(voicings.every((voicing) => voicing.pitchClasses.includes(4)));
  assert.ok(voicings.every((voicing) => voicing.pitchClasses.includes(10)));
  assert.ok(voicings.every((voicing) => !voicing.pitchClasses.includes(7)));
});

test("explicit required pitch classes override default omission requirements", () => {
  const voicings = enumerateVoicings({ pitchClasses: [0, 4, 7, 11], rootPc: 0 }, {
    midiRange: [48, 84],
    voiceCount: 3,
    requiredPitchClasses: [0, 4],
    omittablePitchClasses: [7, 11],
    maxCandidates: 200
  });
  assert.ok(voicings.length > 0);
  assert.ok(voicings.every((voicing) => voicing.pitchClasses.includes(0) && voicing.pitchClasses.includes(4)));
});

test("enumeration is deterministic and obeys hard candidate bounds", () => {
  const options = {
    midiRange: [36, 96],
    voiceCount: 5,
    maxCandidates: 25,
    maxSearchNodes: 10000
  };
  const first = enumerateVoicings(C_MAJOR, options);
  const second = enumerateVoicings(C_MAJOR, options);
  assert.equal(first.length, 25);
  assert.deepEqual(first.map((item) => item.midi), second.map((item) => item.midi));
  assert.equal(first.searchMetadata, undefined);
});

test("voice-leading ranker reuses HHF-017 geometry and favors nearby voicings", () => {
  const source = [48, 55, 60, 64];
  const candidates = enumerateVoicings({ rootPc: 7, templateId: "dominant7" }, {
    midiRange: [43, 76],
    voiceCount: 4,
    maxSpan: 24,
    maxCandidates: 1000
  });
  const ranked = rankVoicingsByVoiceLeading(source, candidates, {
    limit: 8,
    voiceLeadingOptions: {
      commonToneBonus: 0.5,
      voiceCrossingPenalty: 2
    }
  });
  assert.equal(ranked.length, 8);
  assert.ok(ranked.every((item, index) => index === 0 || item.voiceLeading.cost >= ranked[index - 1].voiceLeading.cost));
  assert.equal(ranked[0].voiceLeading.options.commonToneBonus, 0.5);
});

test("invalid chord constraints fail closed", () => {
  assert.throws(() => enumerateVoicings(C_MAJOR, { midiRange: [80, 40] }), /midiRange/);
  assert.throws(() => enumerateVoicings(C_MAJOR, { fixedBassPc: 1 }), /fixedBassPc/);
  assert.throws(() => enumerateVoicings({ rootPc: 0, templateId: "not-a-chord" }), /Unknown chord template/);
});
