import { mod12 } from "../theory/pitch.js";
import {
  AUDIO_PITCH_EVIDENCE_VERSION,
  AUDIO_BASS_EVIDENCE_VERSION,
  harmonicPitchClassSalience,
  buildAudioPitchEvidence
} from "./audio-pitch-evidence.js";

export const LOCAL_AUDIO_ANALYSIS_VERSION = "audio-pitch-v2";

const AUDIO_EXTENSIONS = new Set(["mp3", "m4a", "aac", "wav", "flac", "ogg", "oga", "opus", "webm"]);
const SCORE_EXTENSIONS = new Set(["musicxml", "xml"]);
const MXL_EXTENSIONS = new Set(["mxl"]);
const MIDI_EXTENSIONS = new Set(["mid", "midi"]);

export function classifyLocalMusicFile(file) {
  if (!file) return "unknown";
  const name = String(file.name || "").toLowerCase();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  const type = String(file.type || "").toLowerCase();
  if (MIDI_EXTENSIONS.has(extension) || /audio\/midi|audio\/x-midi|application\/x-midi/.test(type)) return "midi";
  if (MXL_EXTENSIONS.has(extension) || type === "application/vnd.recordare.musicxml") return "mxl";
  if (type.startsWith("audio/") || AUDIO_EXTENSIONS.has(extension)) return "audio";
  if (type.includes("xml") || SCORE_EXTENSIONS.has(extension)) return "musicxml";
  return "unknown";
}

function highestPowerOfTwoAtMost(value) {
  let result = 1;
  while (result * 2 <= value) result *= 2;
  return result;
}

function resampleLinear(input, sourceRate, targetRate) {
  if (!(input instanceof Float32Array) && !ArrayBuffer.isView(input) && !Array.isArray(input)) {
    throw new TypeError("samples must be array-like");
  }
  const src = Number(sourceRate);
  const target = Number(targetRate);
  if (!Number.isFinite(src) || src <= 0 || !Number.isFinite(target) || target <= 0) {
    throw new TypeError("sample rates must be positive finite numbers");
  }
  if (src <= target * 1.03) return Float32Array.from(input);
  const ratio = src / target;
  const length = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const sourceIndex = i * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(input.length - 1, left + 1);
    const frac = sourceIndex - left;
    output[i] = Number(input[left] || 0) * (1 - frac) + Number(input[right] || 0) * frac;
  }
  return output;
}

function fftMagnitudes(frame) {
  const n = frame.length;
  const re = Float64Array.from(frame);
  const im = new Float64Array(n);

  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tmp = re[i]; re[i] = re[j]; re[j] = tmp;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len;
    const wLenRe = Math.cos(angle);
    const wLenIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let j = 0; j < len / 2; j += 1) {
        const even = i + j;
        const odd = even + len / 2;
        const oddRe = re[odd] * wRe - im[odd] * wIm;
        const oddIm = re[odd] * wIm + im[odd] * wRe;
        const evenRe = re[even];
        const evenIm = im[even];
        re[even] = evenRe + oddRe;
        im[even] = evenIm + oddIm;
        re[odd] = evenRe - oddRe;
        im[odd] = evenIm - oddIm;
        const nextWRe = wRe * wLenRe - wIm * wLenIm;
        wIm = wRe * wLenIm + wIm * wLenRe;
        wRe = nextWRe;
      }
    }
  }

  const magnitudes = new Float64Array(n / 2 + 1);
  for (let i = 0; i < magnitudes.length; i += 1) {
    magnitudes[i] = Math.hypot(re[i], im[i]);
  }
  return magnitudes;
}

function spectralMap(windowSize, sampleRate, minHz, maxHz) {
  const bins = [];
  const nyquist = sampleRate / 2;
  const upper = Math.min(maxHz, nyquist - sampleRate / windowSize);
  for (let bin = 1; bin <= windowSize / 2; bin += 1) {
    const frequency = bin * sampleRate / windowSize;
    if (frequency < minHz || frequency > upper) continue;
    const midi = 69 + 12 * Math.log2(frequency / 440);
    const nearest = Math.round(midi);
    const cents = Math.abs(midi - nearest);
    if (cents > 0.45) continue;
    const pitchClass = mod12(nearest);
    const octaveWeight = 1 / Math.sqrt(Math.max(0.35, frequency / 220));
    const tuningWeight = Math.max(0.15, 1 - cents / 0.5);
    bins.push({ bin, pitchClass, weight: octaveWeight * tuningWeight });
  }
  return bins;
}

function frameChromaFromMagnitudes(magnitudes, map) {
  const chroma = Array(12).fill(0);
  for (const item of map) {
    const amplitude = magnitudes[item.bin];
    if (!(amplitude > 0)) continue;
    chroma[item.pitchClass] += Math.sqrt(amplitude) * item.weight;
  }
  const max = Math.max(...chroma, 1e-12);
  return chroma.map((value) => value / max);
}

function mergeActivityFrames(frames, hopSeconds, threshold, maxPitchClasses) {
  const open = Array(12).fill(null);
  const events = [];

  const close = (pc) => {
    const event = open[pc];
    if (!event) return;
    events.push(Object.freeze({
      onset: event.onset,
      duration: Math.max(hopSeconds, event.end - event.onset),
      pitchClass: pc,
      midi: 60 + pc,
      isRest: false,
      tieStart: false,
      tieStop: false,
      source: "audio-chroma",
      confidence: event.strengthSum / Math.max(1, event.frames)
    }));
    open[pc] = null;
  };

  for (const frame of frames) {
    const ordered = frame.chroma
      .map((strength, pc) => ({ pc, strength }))
      .sort((a, b) => b.strength - a.strength || a.pc - b.pc);
    const explicit = Array.isArray(frame.pitchClasses) ? frame.pitchClasses : null;
    const active = explicit?.length
      ? new Set(explicit)
      : new Set(ordered
        .filter((item, index) => index < maxPitchClasses && item.strength >= threshold)
        .map((item) => item.pc));

    for (let pc = 0; pc < 12; pc += 1) {
      if (!active.has(pc)) {
        close(pc);
        continue;
      }
      const strength = frame.chroma[pc];
      if (!open[pc]) {
        open[pc] = { onset: frame.time, end: frame.time + hopSeconds, strengthSum: strength, frames: 1 };
      } else {
        open[pc].end = frame.time + hopSeconds;
        open[pc].strengthSum += strength;
        open[pc].frames += 1;
      }
    }
  }
  for (let pc = 0; pc < 12; pc += 1) close(pc);
  events.sort((a, b) => a.onset - b.onset || a.pitchClass - b.pitchClass);
  return Object.freeze(events);
}

export function analyzePcmChroma(samplesRaw, sampleRateRaw, options = {}) {
  const sourceRate = Number(sampleRateRaw);
  if (!Number.isFinite(sourceRate) || sourceRate <= 0) throw new TypeError("sampleRate must be a positive finite number");
  if (!samplesRaw?.length) throw new TypeError("samples must not be empty");

  const targetRate = Math.min(sourceRate, Number(options.targetSampleRate || 11025));
  const samples = resampleLinear(samplesRaw, sourceRate, targetRate);
  const requestedWindow = Number(options.windowSize || 4096);
  const windowSize = highestPowerOfTwoAtMost(Math.max(512, Math.min(requestedWindow, samples.length)));
  if (windowSize < 512) throw new Error("audio is too short for chroma analysis");
  const maxFrames = Math.max(60, Number(options.maxFrames || 1200));
  const minimumHop = Math.max(256, Math.floor(windowSize * 0.75));
  const requiredHop = Math.ceil(Math.max(1, samples.length - windowSize) / Math.max(1, maxFrames - 1));
  const hop = Math.max(minimumHop, requiredHop);
  const hopSeconds = hop / targetRate;
  const minHz = Number(options.minHz || 55);
  const maxHz = Number(options.maxHz || 3520);
  const map = spectralMap(windowSize, targetRate, minHz, maxHz);
  const bassMap = spectralMap(
    windowSize,
    targetRate,
    Number(options.bassMinHz || 55),
    Number(options.bassMaxHz || 330)
  );
  const frames = [];
  const overall = Array(12).fill(0);
  const frame = new Float64Array(windowSize);

  for (let start = 0; start + windowSize <= samples.length; start += hop) {
    for (let i = 0; i < windowSize; i += 1) {
      const hann = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (windowSize - 1));
      frame[i] = samples[start + i] * hann;
    }
    const magnitudes = fftMagnitudes(frame);
    const baseChroma = frameChromaFromMagnitudes(magnitudes, map);
    const harmonicChroma = harmonicPitchClassSalience(magnitudes, targetRate, windowSize, options);
    const bassChroma = frameChromaFromMagnitudes(magnitudes, bassMap);
    const evidence = buildAudioPitchEvidence({ baseChroma, harmonicChroma, bassChroma, options });
    const chroma = evidence.chroma;
    for (let pc = 0; pc < 12; pc += 1) overall[pc] += chroma[pc];
    frames.push(Object.freeze({
      time: start / targetRate,
      chroma,
      pitchClasses: evidence.pitchClasses,
      bassPc: evidence.bassPc,
      bassCandidatePc: evidence.bassCandidatePc,
      bassConfidence: evidence.bassConfidence,
      bassEvidenceClass: evidence.bassEvidenceClass
    }));
  }

  if (!frames.length) throw new Error("audio is too short for chroma analysis");
  const total = overall.reduce((sum, value) => sum + value, 0) || 1;
  const overallChroma = Object.freeze(overall.map((value) => value / total));
  const events = mergeActivityFrames(
    frames,
    hopSeconds,
    Number(options.eventThreshold || 0.60),
    Math.max(1, Number(options.maxPitchClassesPerFrame || 4))
  );

  return Object.freeze({
    version: LOCAL_AUDIO_ANALYSIS_VERSION,
    pitchEvidenceVersion: AUDIO_PITCH_EVIDENCE_VERSION,
    bassEvidenceVersion: AUDIO_BASS_EVIDENCE_VERSION,
    evidenceClass: "inferred-from-audio",
    sampleRate: targetRate,
    sourceSampleRate: sourceRate,
    windowSize,
    hopSamples: hop,
    hopSeconds,
    frameCount: frames.length,
    durationSeconds: samples.length / targetRate,
    overallChroma,
    frames: Object.freeze(frames),
    events,
    note: "Pitch classes use blended spectral and harmonic-salience evidence. Bass is emitted only when low-frequency evidence clears its ambiguity gate; this is not a score transcription."
  });
}

function downmixAudioBuffer(audioBuffer) {
  const channels = Math.max(1, audioBuffer.numberOfChannels || 1);
  const length = audioBuffer.length;
  const mono = new Float32Array(length);
  for (let channel = 0; channel < channels; channel += 1) {
    const data = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) mono[i] += data[i] / channels;
  }
  return mono;
}

export async function analyzeLocalAudioFile(file, options = {}) {
  if (classifyLocalMusicFile(file) !== "audio") throw new TypeError("file is not recognized as audio");
  const AudioContextImpl = options.AudioContextImpl || globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextImpl) throw new Error("Web Audio decoding is unavailable in this browser");
  const context = new AudioContextImpl();
  try {
    const bytes = await file.arrayBuffer();
    const decoded = await context.decodeAudioData(bytes.slice(0));
    const mono = downmixAudioBuffer(decoded);
    return analyzePcmChroma(mono, decoded.sampleRate, options);
  } catch (error) {
    throw new Error(`Could not decode this audio file locally: ${error?.message || error}`);
  } finally {
    if (typeof context.close === "function") {
      try { await context.close(); } catch { /* no-op */ }
    }
  }
}
