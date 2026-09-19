export const AUDIO_PITCH_EVIDENCE_VERSION = "audio-pitch-evidence-v2";
export const AUDIO_BASS_EVIDENCE_VERSION = "audio-bass-evidence-v1";
export const AUDIO_REGISTERED_NOTE_VERSION = "audio-registered-note-v1";

function normalizeMax(valuesRaw) {
  const values = Array.from({ length: 12 }, (_, pc) => Math.max(0, Number(valuesRaw?.[pc]) || 0));
  const max = Math.max(...values, 1e-12);
  return Object.freeze(values.map((value) => value / max));
}

function localPeakAboveFloor(magnitudes, frequency, sampleRate, windowSize) {
  const center = Math.round(frequency * windowSize / sampleRate);
  if (center < 1 || center >= magnitudes.length) return 0;
  const peakStart = Math.max(1, center - 1);
  const peakEnd = Math.min(magnitudes.length - 1, center + 1);
  let peak = 0;
  for (let bin = peakStart; bin <= peakEnd; bin += 1) {
    peak = Math.max(peak, Number(magnitudes[bin]) || 0);
  }

  let floorSum = 0;
  let floorCount = 0;
  const floorStart = Math.max(1, center - 8);
  const floorEnd = Math.min(magnitudes.length - 1, center + 8);
  for (let bin = floorStart; bin <= floorEnd; bin += 1) {
    if (bin >= peakStart && bin <= peakEnd) continue;
    floorSum += Number(magnitudes[bin]) || 0;
    floorCount += 1;
  }
  const floor = floorCount ? floorSum / floorCount : 0;
  return Math.max(0, peak - floor);
}

export function harmonicPitchClassSalience(magnitudes, sampleRateRaw, windowSizeRaw, options = {}) {
  const sampleRate = Number(sampleRateRaw);
  const windowSize = Number(windowSizeRaw);
  if (!magnitudes?.length || !Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isFinite(windowSize) || windowSize <= 0) {
    throw new TypeError("harmonic salience requires magnitudes, sampleRate, and windowSize");
  }

  const midiMin = Math.round(Number(options.harmonicMidiMin ?? 33));
  const midiMax = Math.round(Number(options.harmonicMidiMax ?? 96));
  const harmonicWeights = options.harmonicWeights || [1, 0.65, 0.42, 0.30, 0.22, 0.16];
  const top = Array(12).fill(0);
  const second = Array(12).fill(0);

  for (let midi = midiMin; midi <= midiMax; midi += 1) {
    const fundamental = 440 * Math.pow(2, (midi - 69) / 12);
    let score = 0;
    for (let harmonic = 1; harmonic <= harmonicWeights.length; harmonic += 1) {
      const frequency = fundamental * harmonic;
      if (frequency >= sampleRate / 2) break;
      const excess = localPeakAboveFloor(magnitudes, frequency, sampleRate, windowSize);
      score += Number(harmonicWeights[harmonic - 1] || 0) * Math.sqrt(excess);
    }
    const pc = ((midi % 12) + 12) % 12;
    if (score > top[pc]) {
      second[pc] = top[pc];
      top[pc] = score;
    } else if (score > second[pc]) {
      second[pc] = score;
    }
  }

  return normalizeMax(top.map((value, pc) => value + 0.35 * second[pc]));
}

export function combinePitchEvidence(baseChroma, harmonicChroma, options = {}) {
  const base = normalizeMax(baseChroma);
  const harmonic = normalizeMax(harmonicChroma);
  const blend = Math.max(0, Math.min(1, Number(options.harmonicBlend ?? 0.10)));
  return normalizeMax(base.map((value, pc) => (1 - blend) * value + blend * harmonic[pc]));
}

export function selectAdaptivePitchClasses(chromaRaw, options = {}) {
  const chroma = normalizeMax(chromaRaw);
  const ordered = chroma
    .map((strength, pc) => ({ pc, strength }))
    .sort((a, b) => b.strength - a.strength || a.pc - b.pc);
  if (!ordered.length || ordered[0].strength <= 0) return Object.freeze([]);

  const primaryFloor = Number(options.primaryPitchFloor ?? 0.525);
  const fourthFloor = Number(options.fourthPitchFloor ?? 0.60);
  const fourthToThirdRatio = Number(options.fourthToThirdRatio ?? 0.82);
  const selected = [ordered[0].pc];

  for (let index = 1; index < Math.min(3, ordered.length); index += 1) {
    if (ordered[index].strength >= ordered[0].strength * primaryFloor) selected.push(ordered[index].pc);
  }

  if (
    ordered.length >= 4 &&
    selected.length >= 3 &&
    ordered[3].strength >= ordered[0].strength * fourthFloor &&
    ordered[3].strength >= ordered[2].strength * fourthToThirdRatio
  ) {
    selected.push(ordered[3].pc);
  }

  return Object.freeze([...selected].sort((a, b) => a - b));
}

export function inferBassEvidence(bassChromaRaw, options = {}) {
  const bassChroma = normalizeMax(bassChromaRaw);
  const ordered = bassChroma
    .map((strength, pc) => ({ pc, strength }))
    .sort((a, b) => b.strength - a.strength || a.pc - b.pc);
  const top = ordered[0];
  const second = ordered[1] || { strength: 0 };
  const margin = top?.strength > 0
    ? Math.max(0, (top.strength - second.strength) / top.strength)
    : 0;
  const minimumMargin = Number(options.bassMinimumMargin ?? 0.45);
  return Object.freeze({
    bassPc: margin >= minimumMargin ? top.pc : null,
    candidatePc: top?.pc ?? null,
    confidence: margin,
    minimumMargin,
    evidenceClass: margin >= minimumMargin
      ? "inferred-low-frequency-audio"
      : "ambiguous-low-frequency-audio"
  });
}

export function buildAudioPitchEvidence({
  baseChroma,
  harmonicChroma,
  bassChroma,
  options = {}
}) {
  const chroma = combinePitchEvidence(baseChroma, harmonicChroma, options);
  const pitchClasses = selectAdaptivePitchClasses(chroma, options);
  const bass = inferBassEvidence(bassChroma, options);
  return Object.freeze({
    version: AUDIO_PITCH_EVIDENCE_VERSION,
    bassVersion: AUDIO_BASS_EVIDENCE_VERSION,
    chroma,
    pitchClasses,
    bassPc: bass.bassPc,
    bassCandidatePc: bass.candidatePc,
    bassConfidence: bass.confidence,
    bassEvidenceClass: bass.evidenceClass
  });
}


function validateSpectralInputs(magnitudes, sampleRateRaw, windowSizeRaw) {
  const sampleRate = Number(sampleRateRaw);
  const windowSize = Number(windowSizeRaw);
  if (!magnitudes?.length || !Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isFinite(windowSize) || windowSize <= 0) {
    throw new TypeError("registered-note evidence requires magnitudes, sampleRate, and windowSize");
  }
  return { sampleRate, windowSize };
}

export function registeredMidiSalience(magnitudes, sampleRateRaw, windowSizeRaw, options = {}) {
  const { sampleRate, windowSize } = validateSpectralInputs(magnitudes, sampleRateRaw, windowSizeRaw);
  const midiMin = Math.max(0, Math.round(Number(options.registeredMidiMin ?? 33)));
  const midiMax = Math.min(127, Math.round(Number(options.registeredMidiMax ?? 96)));
  if (midiMax < midiMin) throw new RangeError("registeredMidiMax must be >= registeredMidiMin");

  const harmonicWeights = options.registeredHarmonicWeights || [1, 0.45, 0.28, 0.18];
  const rows = [];

  for (let midi = midiMin; midi <= midiMax; midi += 1) {
    const fundamentalHz = 440 * Math.pow(2, (midi - 69) / 12);
    if (fundamentalHz >= sampleRate / 2) break;

    const fundamentalExcess = localPeakAboveFloor(magnitudes, fundamentalHz, sampleRate, windowSize);
    const fundamental = Math.sqrt(fundamentalExcess);
    let partialSupport = 0;

    for (let harmonic = 2; harmonic <= harmonicWeights.length; harmonic += 1) {
      const frequency = fundamentalHz * harmonic;
      if (frequency >= sampleRate / 2) break;
      const excess = localPeakAboveFloor(magnitudes, frequency, sampleRate, windowSize);
      partialSupport += Number(harmonicWeights[harmonic - 1] || 0) * Math.sqrt(excess);
    }

    const rawScore = 0.82 * fundamental + 0.18 * partialSupport;
    const fundamentalShare = rawScore > 0
      ? fundamental / Math.max(fundamental + partialSupport, 1e-12)
      : 0;
    const subharmonicGuard = 0.25 + 0.75 * fundamentalShare;
    rows.push({
      midi,
      pitchClass: ((midi % 12) + 12) % 12,
      rawScore: rawScore * subharmonicGuard,
      fundamentalShare
    });
  }

  const max = Math.max(...rows.map((row) => row.rawScore), 1e-12);
  return Object.freeze(rows.map((row) => Object.freeze({
    ...row,
    confidence: row.rawScore / max
  })));
}

export function inferRegisteredFrameNotes(
  magnitudes,
  sampleRateRaw,
  windowSizeRaw,
  {
    pitchClasses = null,
    bassPc = null,
    options = {}
  } = {}
) {
  const salience = registeredMidiSalience(magnitudes, sampleRateRaw, windowSizeRaw, options);
  const requestedPcs = Array.isArray(pitchClasses) && pitchClasses.length
    ? [...new Set(pitchClasses.map((pc) => ((Number(pc) % 12) + 12) % 12))]
    : [...new Set(
      salience
        .slice()
        .sort((a, b) => b.confidence - a.confidence || a.midi - b.midi)
        .slice(0, Math.max(1, Number(options.maxRegisteredNotesPerFrame ?? 6)))
        .map((row) => row.pitchClass)
    )];

  const minimumConfidence = Number(options.registeredMinimumConfidence ?? 0.34);
  const octaveDoublingRatio = Number(options.registeredOctaveDoublingRatio ?? 0.88);
  const octaveDoublingFloor = Number(options.registeredOctaveDoublingFloor ?? 0.58);
  const allowOctaveDoubling = options.allowRegisteredOctaveDoubling !== false;
  const selected = [];

  for (const pc of requestedPcs) {
    const candidates = salience
      .filter((row) => row.pitchClass === pc)
      .sort((a, b) => b.confidence - a.confidence || a.midi - b.midi);
    const lead = candidates[0];
    if (!lead || lead.confidence < minimumConfidence) continue;
    selected.push(lead);

    if (allowOctaveDoubling) {
      const second = candidates.find((row) => row.midi !== lead.midi);
      if (
        second &&
        second.confidence >= octaveDoublingFloor &&
        second.confidence >= lead.confidence * octaveDoublingRatio
      ) {
        selected.push(second);
      }
    }

    if (bassPc != null && pc === ((Number(bassPc) % 12) + 12) % 12) {
      const bassMidiMax = Number(options.registeredBassMidiMax ?? 60);
      const lower = candidates
        .filter((row) => row.midi <= bassMidiMax)
        .sort((a, b) => b.confidence - a.confidence || a.midi - b.midi)[0];
      if (
        lower &&
        lower.midi !== lead.midi &&
        lower.confidence >= minimumConfidence &&
        lower.confidence >= lead.confidence * 0.72
      ) {
        selected.push(lower);
      }
    }
  }

  const unique = new Map();
  for (const row of selected) {
    const previous = unique.get(row.midi);
    if (!previous || row.confidence > previous.confidence) unique.set(row.midi, row);
  }
  const maxNotes = Math.max(1, Number(options.maxRegisteredNotesPerFrame ?? 6));
  return Object.freeze(
    [...unique.values()]
      .sort((a, b) => b.confidence - a.confidence || a.midi - b.midi)
      .slice(0, maxNotes)
      .sort((a, b) => a.midi - b.midi)
      .map((row) => Object.freeze({
        midi: row.midi,
        pitchClass: row.pitchClass,
        octave: Math.floor(row.midi / 12) - 1,
        confidence: row.confidence,
        fundamentalShare: row.fundamentalShare,
        evidenceClass: "inferred-registered-audio"
      }))
  );
}
