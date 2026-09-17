import { scoreFunctionalContinuation } from "./scores/function-score.js";
import { scoreVoiceLeadingContinuation } from "./scores/voice-leading-score.js";
import { scoreCorpusContinuation, scoreStyleContinuation } from "./scores/evidence-score.js";
import { scoreNoveltyContinuation } from "./scores/novelty-score.js";
import { scoreHolographicContinuation } from "./scores/holographic-score.js";

export const CONTINUATION_SCORE_DIMENSIONS = Object.freeze([
  "functional",
  "voiceLeading",
  "corpusFrequency",
  "styleSimilarity",
  "novelty",
  "holographicContinuity"
]);

export function scoreContinuationCandidate(candidate, context = {}, options = {}) {
  if (!candidate || !Array.isArray(candidate.pitchClasses)) throw new TypeError("candidate must contain pitchClasses");
  const dimensions = {
    functional: scoreFunctionalContinuation(candidate, context, options.functional),
    voiceLeading: scoreVoiceLeadingContinuation(candidate, context, options.voiceLeading),
    corpusFrequency: scoreCorpusContinuation(candidate, context),
    styleSimilarity: scoreStyleContinuation(candidate, context),
    novelty: scoreNoveltyContinuation(candidate, context, options.novelty),
    holographicContinuity: scoreHolographicContinuation(candidate, context, options.holographic)
  };
  return Object.freeze({
    candidate,
    dimensions: Object.freeze(dimensions),
    availableDimensions: Object.freeze(CONTINUATION_SCORE_DIMENSIONS.filter((name) => dimensions[name].available)),
    unavailableDimensions: Object.freeze(CONTINUATION_SCORE_DIMENSIONS.filter((name) => !dimensions[name].available)),
    evidenceClass: "mixed",
    combinedScore: null,
    note: "HHF-020 intentionally does not combine independent continuation objectives."
  });
}

export function scoreContinuationCandidates(candidates, context = {}, options = {}) {
  if (!Array.isArray(candidates)) throw new TypeError("candidates must be an array");
  return Object.freeze(candidates.map((candidate) => scoreContinuationCandidate(candidate, context, options)));
}
