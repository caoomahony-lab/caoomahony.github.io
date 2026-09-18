import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { analyzePcmChroma, classifyLocalMusicFile, LOCAL_AUDIO_ANALYSIS_VERSION } from "../src/music/local-audio.js";

function sine(sampleRate, seconds, frequency, amplitude = 1) {
  const samples = new Float32Array(Math.floor(sampleRate * seconds));
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate);
  }
  return samples;
}

function chord(sampleRate, seconds, frequencies) {
  const samples = new Float32Array(Math.floor(sampleRate * seconds));
  for (let i = 0; i < samples.length; i += 1) {
    let value = 0;
    for (const frequency of frequencies) value += Math.sin(2 * Math.PI * frequency * i / sampleRate);
    samples[i] = value / frequencies.length;
  }
  return samples;
}

test("local music picker recognizes common phone audio and MusicXML without treating unknown files as music", () => {
  assert.equal(classifyLocalMusicFile({ name: "song.m4a", type: "audio/mp4" }), "audio");
  assert.equal(classifyLocalMusicFile({ name: "song.FLAC", type: "" }), "audio");
  assert.equal(classifyLocalMusicFile({ name: "score.musicxml", type: "application/xml" }), "musicxml");
  assert.equal(classifyLocalMusicFile({ name: "notes.txt", type: "text/plain" }), "unknown");
});

test("audio chroma inference identifies a synthetic A4 without claiming score transcription", () => {
  const sampleRate = 11025;
  const analysis = analyzePcmChroma(sine(sampleRate, 2.2, 440), sampleRate, { windowSize: 2048 });
  const strongest = analysis.overallChroma.indexOf(Math.max(...analysis.overallChroma));
  assert.equal(strongest, 9);
  assert.equal(analysis.version, LOCAL_AUDIO_ANALYSIS_VERSION);
  assert.equal(analysis.pitchEvidenceVersion, "audio-pitch-evidence-v2");
  assert.equal(analysis.bassEvidenceVersion, "audio-bass-evidence-v1");
  assert.equal(analysis.evidenceClass, "inferred-from-audio");
  assert.match(analysis.note, /not a score transcription/i);
  assert.ok(analysis.events.some((event) => event.pitchClass === 9));
});

test("audio chroma inference retains the pitch classes of a synthetic C major triad", () => {
  const sampleRate = 11025;
  const frequencies = [261.625565, 329.627557, 391.995436];
  const analysis = analyzePcmChroma(chord(sampleRate, 2.4, frequencies), sampleRate, { windowSize: 2048 });
  const top = analysis.overallChroma
    .map((strength, pc) => ({ pc, strength }))
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5)
    .map((entry) => entry.pc);
  for (const pc of [0, 4, 7]) assert.ok(top.includes(pc), `expected pitch class ${pc} in top chroma ${top}`);
});

test("audio pitch v2 emits explicit sparse pitch sets and confidence-gated bass evidence", () => {
  const sampleRate = 11025;
  const frequencies = [130.812783, 329.627557, 391.995436];
  const analysis = analyzePcmChroma(chord(sampleRate, 2.4, frequencies), sampleRate, { windowSize: 4096 });
  assert.ok(analysis.frames.every((frame) => Array.isArray(frame.pitchClasses)));
  assert.ok(analysis.frames.every((frame) => frame.pitchClasses.length >= 1 && frame.pitchClasses.length <= 4));
  assert.ok(analysis.frames.some((frame) => frame.bassPc === 0));
  assert.ok(analysis.frames.every((frame) => frame.bassPc == null || (frame.bassConfidence >= 0.45 && frame.bassConfidence <= 1)));
});

test("browser app exposes a local Open music control and explicit privacy/evidence language", () => {
  const source = fs.readFileSync(new URL("../src/app/app.js", import.meta.url), "utf8");
  assert.match(source, /Open music/);
  assert.match(source, /type = "file"/);
  assert.match(source, /audio\/\*/);
  assert.match(source, /not uploaded by Harmonic Savant/);
  assert.match(source, /inferred-from-audio/);
});
