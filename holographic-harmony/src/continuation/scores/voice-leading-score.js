import { enumerateVoicings, rankVoicingsByVoiceLeading } from "../voicing-enumerator.js";

function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }

function defaultRangeFromSource(source) {
  const min = Math.max(0, Math.min(...source) - 12);
  const max = Math.min(127, Math.max(...source) + 12);
  return [min, max];
}

export function scoreVoiceLeadingContinuation(candidate, context = {}, options = {}) {
  if (!candidate || !Array.isArray(candidate.pitchClasses)) throw new TypeError("candidate must contain pitchClasses");
  if (!Array.isArray(context.currentVoicing) || !context.currentVoicing.length) {
    return Object.freeze({
      available: false,
      score: null,
      reason: "currentVoicing is required",
      evidenceClass: "deterministic-derived"
    });
  }

  const source = [...context.currentVoicing];
  const voiceCount = Number(options.voiceCount ?? source.length);
  if (!Number.isInteger(voiceCount) || voiceCount < 1) throw new RangeError("voiceCount must be a positive integer");
  const midiRange = options.midiRange ?? defaultRangeFromSource(source);
  const chord = candidate.rootPc != null && candidate.templateId
    ? { rootPc: candidate.rootPc, templateId: candidate.templateId }
    : { pitchClasses: candidate.pitchClasses, rootPc: candidate.rootPc ?? null };

  const voicings = enumerateVoicings(chord, {
    midiRange,
    voiceCount,
    maxSpan: options.maxSpan ?? 28,
    maxAdjacentSpacing: options.maxAdjacentSpacing ?? 14,
    maxCandidates: options.maxVoicingCandidates ?? 500,
    maxSearchNodes: options.maxSearchNodes ?? 50000,
    allowDoubling: options.allowDoubling !== false,
    omissionPolicy: options.omissionPolicy ?? "extended",
    requiredPitchClasses: options.requiredPitchClasses,
    omittablePitchClasses: options.omittablePitchClasses,
    fixedBassPc: options.fixedBassPc,
    fixedSopranoPc: options.fixedSopranoPc
  });

  if (!voicings.length) {
    return Object.freeze({
      available: false,
      score: null,
      reason: "no legal target voicings under current constraints",
      candidateVoicingCount: 0,
      evidenceClass: "deterministic-derived"
    });
  }

  const ranked = rankVoicingsByVoiceLeading(source, voicings, {
    limit: 1,
    voiceLeadingOptions: options.voiceLeadingOptions ?? {}
  });
  const best = ranked[0];
  const matched = Math.max(1, best.voiceLeading.matchedVoiceCount);
  const costPerMatchedVoice = best.voiceLeading.cost / matched;
  const scale = Number(options.smoothnessScale ?? 3);
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError("smoothnessScale must be positive");
  const score = clamp01(1 / (1 + costPerMatchedVoice / scale));

  return Object.freeze({
    available: true,
    score,
    bestVoicing: Object.freeze([...(Array.isArray(best.voicing) ? best.voicing : best.voicing.midi)]),
    objectiveCost: best.voiceLeading.cost,
    movementSemitones: best.voiceLeading.movementSemitones,
    movementPerMatchedVoice: best.voiceLeading.movementSemitones / matched,
    costPerMatchedVoice,
    commonToneRetention: best.voiceLeading.commonToneRetention,
    bassRetained: best.voiceLeading.bassRetained,
    sopranoRetained: best.voiceLeading.sopranoRetained,
    crossingCount: best.voiceLeading.crossingCount,
    motionClass: best.voiceLeading.motion.motionClass,
    candidateVoicingCount: voicings.length,
    smoothnessScale: scale,
    evidenceClass: "deterministic-derived",
    note: "Bounded transform of HHF-017 objective cost; not a probability."
  });
}
