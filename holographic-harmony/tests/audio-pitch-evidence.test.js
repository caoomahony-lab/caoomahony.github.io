import test from "node:test";
import assert from "node:assert/strict";
import {
  combinePitchEvidence,
  selectAdaptivePitchClasses,
  inferBassEvidence,
  registeredMidiSalience,
  inferRegisteredFrameNotes,
  AUDIO_PITCH_EVIDENCE_VERSION,
  AUDIO_BASS_EVIDENCE_VERSION,
  AUDIO_REGISTERED_NOTE_VERSION
} from "../src/music/audio-pitch-evidence.js";

test("v2 pitch evidence keeps sparse evidence sparse", () => {
  const base = [0.02,0.01,0.01,0.02,0.01,0.01,0.02,0.01,0.01,1,0.01,0.01];
  const harmonic = [0.01,0.01,0.02,0.01,0.01,0.01,0.01,0.02,0.01,1,0.01,0.01];
  const chroma = combinePitchEvidence(base, harmonic);
  assert.deepEqual(selectAdaptivePitchClasses(chroma), [9]);
  assert.equal(AUDIO_PITCH_EVIDENCE_VERSION, "audio-pitch-evidence-v2");
});

test("adaptive pitch evidence admits a strongly supported fourth pitch without padding one", () => {
  const dense = [1,0,0.02,0,0.91,0,0,0.88,0,0.84,0,0];
  const sparse = [1,0,0.02,0,0.80,0,0,0.30,0,0.20,0,0];
  assert.deepEqual(selectAdaptivePitchClasses(dense), [0,4,7,9]);
  assert.deepEqual(selectAdaptivePitchClasses(sparse), [0,4]);
});

test("bass evidence is withheld when the low-frequency winner is ambiguous", () => {
  const confident = [1,0.1,0.05,0.02,0.03,0.02,0.01,0.2,0.02,0.01,0.02,0.01];
  const ambiguous = [1,0.1,0.05,0.02,0.03,0.02,0.01,0.8,0.02,0.01,0.02,0.01];
  assert.equal(inferBassEvidence(confident).bassPc, 0);
  assert.equal(inferBassEvidence(ambiguous).bassPc, null);
  assert.equal(AUDIO_BASS_EVIDENCE_VERSION, "audio-bass-evidence-v1");
});


test("registered MIDI salience favors the actual octave over its subharmonic candidate", () => {
  const sampleRate = 11025;
  const windowSize = 4096;
  const magnitudes = new Float64Array(windowSize / 2 + 1);
  const frequency = 220;
  const bin = Math.round(frequency * windowSize / sampleRate);
  magnitudes[bin] = 100;

  const ranked = registeredMidiSalience(magnitudes, sampleRate, windowSize)
    .slice()
    .sort((a, b) => b.confidence - a.confidence || a.midi - b.midi);
  assert.equal(ranked[0].midi, 57);
  assert.equal(AUDIO_REGISTERED_NOTE_VERSION, "audio-registered-note-v1");

  const notes = inferRegisteredFrameNotes(
    magnitudes,
    sampleRate,
    windowSize,
    { pitchClasses: [9], bassPc: 9 }
  );
  assert.ok(notes.some((note) => note.midi === 57));
  assert.ok(notes.every((note) => note.pitchClass === 9));
});
