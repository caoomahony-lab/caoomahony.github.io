import test from "node:test";
import assert from "node:assert/strict";
import { parseChordSymbol, parseRegisteredPitch, parseRegisteredVoicing } from "../src/input/chord-symbols.js";
import { parseChordSequence, parseContinuationInput } from "../src/input/chord-sequence.js";

test("common chord symbols map to canonical chord templates", () => {
  const cases = [
    ["C", 0, "major"],
    ["Am", 9, "minor"],
    ["F#maj7", 6, "major7"],
    ["Bb7", 10, "dominant7"],
    ["C#m9", 1, "minor9"],
    ["Bø7", 11, "halfDiminished7"],
    ["Gdim7", 7, "diminished7"],
    ["Dsus4", 2, "sus4"]
  ];
  for (const [symbol, rootPc, templateId] of cases) {
    const parsed = parseChordSymbol(symbol);
    assert.equal(parsed.rootPc, rootPc);
    assert.equal(parsed.templateId, templateId);
    assert.ok(parsed.pitchClasses.length >= 3);
  }
});

test("slash bass is preserved independently from chord pitch classes", () => {
  const chord = parseChordSymbol("E7/G#");
  assert.equal(chord.rootPc, 4);
  assert.equal(chord.templateId, "dominant7");
  assert.equal(chord.bassPc, 8);
  assert.equal(chord.bassSpelling, "G#");
  assert.equal(chord.bassInChord, true);

  const nonChordBass = parseChordSymbol("C/D");
  assert.equal(nonChordBass.bassPc, 2);
  assert.equal(nonChordBass.bassInChord, false);
});

test("Unicode accidentals are accepted", () => {
  const chord = parseChordSymbol("B♭maj7/D");
  assert.equal(chord.rootPc, 10);
  assert.equal(chord.templateId, "major7");
  assert.equal(chord.bassPc, 2);
});

test("registered pitch parser preserves spelled octave semantics", () => {
  assert.equal(parseRegisteredPitch("C4"), 60);
  assert.equal(parseRegisteredPitch("F#3"), 54);
  assert.equal(parseRegisteredPitch("Bb2"), 46);
  assert.equal(parseRegisteredPitch("Cb4"), 59);
  assert.equal(parseRegisteredPitch("B#3"), 60);
  assert.equal(parseRegisteredPitch("60"), 60);
});

test("registered voicing accepts note names or MIDI and returns sorted MIDI", () => {
  assert.deepEqual(parseRegisteredVoicing("E4 C3 G3 C4"), [48, 55, 60, 64]);
  assert.deepEqual(parseRegisteredVoicing("64,48,55,60"), [48, 55, 60, 64]);
  assert.deepEqual(parseRegisteredVoicing(""), []);
});

test("progression parser accepts bars and produces function-engine input", () => {
  const result = parseChordSequence("Cmaj7 | E7/G# | Am9 | Fmaj7");
  assert.equal(result.chords.length, 4);
  assert.equal(result.chords[1].bassPc, 8);
  assert.equal(result.currentChord.rootPc, 5);
  assert.equal(result.currentChord.templateId, "major7");
  assert.equal(result.analysisSequence.length, 4);
  assert.deepEqual(result.analysisSequence[1].pcs, result.chords[1].pitchClasses);
});

test("space-separated simple progressions are accepted when no explicit separators are used", () => {
  const result = parseChordSequence("C Am F G");
  assert.deepEqual(result.chords.map((chord) => chord.templateId), ["major", "minor", "major", "major"]);
});

test("combined continuation input keeps harmonic sequence and registered voicing separate", () => {
  const result = parseContinuationInput({
    progression: "C | Am | F | G",
    currentVoicing: "G2 D3 G3 B3"
  });
  assert.equal(result.sequence.chords.length, 4);
  assert.deepEqual(result.currentVoicing, [43, 50, 55, 59]);
});

test("unsupported grammar fails closed rather than guessing", () => {
  assert.throws(() => parseChordSymbol("C13#11"), /unsupported chord suffix/);
  assert.throws(() => parseChordSymbol("H7"), /unsupported chord symbol/);
  assert.throws(() => parseRegisteredPitch("Cquartersharp4"), /unsupported registered pitch/);
  assert.throws(() => parseChordSequence(""), /must not be empty/);
});
