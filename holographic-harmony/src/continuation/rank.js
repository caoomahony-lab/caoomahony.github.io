import { CONTINUATION_SCORE_DIMENSIONS } from "./score-candidate.js";
import { continuationCandidateKey } from "./scores/evidence-score.js";

export const CONTINUATION_WEIGHT_PRESETS = Object.freeze({
  balanced: Object.freeze({
    functional: 1,
    voiceLeading: 1,
    corpusFrequency: 1,
    styleSimilarity: 1,
    novelty: 1,
    holographicContinuity: 1
  }),
  functional: Object.freeze({
    functional: 4,
    voiceLeading: 1,
    corpusFrequency: 0,
    styleSimilarity: 0,
    novelty: 0,
    holographicContinuity: 0
  }),
  "voice-leading": Object.freeze({
    functional: 1,
    voiceLeading: 4,
    corpusFrequency: 0,
    styleSimilarity: 0,
    novelty: 0,
    holographicContinuity: 0
  }),
  adventurous: Object.freeze({
    functional: 1,
    voiceLeading: 1,
    corpusFrequency: 0,
    styleSimilarity: 0,
    novelty: 4,
    holographicContinuity: 1
  }),
  holographic: Object.freeze({
    functional: 1,
    voiceLeading: 1,
    corpusFrequency: 0,
    styleSimilarity: 0,
    novelty: 0,
    holographicContinuity: 4
  }),
  "my-style": Object.freeze({
    functional: 1,
    voiceLeading: 1,
    corpusFrequency: 0,
    styleSimilarity: 4,
    novelty: 0,
    holographicContinuity: 0
  })
});

const DIMENSION_SET = new Set(CONTINUATION_SCORE_DIMENSIONS);
const MISSING_POLICIES = new Set(["renormalize", "zero", "require"]);
const EPSILON = 1e-12;

function validateWeights(weights) {
  if (!weights || typeof weights !== "object" || Array.isArray(weights)) {
    throw new TypeError("weights must be an object keyed by continuation score dimension");
  }
  for (const key of Object.keys(weights)) {
    if (!DIMENSION_SET.has(key)) throw new RangeError(`Unknown continuation weight dimension: ${key}`);
  }
  const normalized = Object.fromEntries(CONTINUATION_SCORE_DIMENSIONS.map((name) => {
    const value = Number(weights[name] ?? 0);
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} weight must be finite and nonnegative`);
    return [name, value];
  }));
  if (Object.values(normalized).every((value) => value <= 0)) {
    throw new RangeError("at least one continuation weight must be positive");
  }
  return Object.freeze(normalized);
}

export function resolveContinuationWeights({ weights = null, preset = null } = {}) {
  if (weights != null && preset != null) throw new TypeError("provide either weights or preset, not both");
  if (preset != null) {
    const selected = CONTINUATION_WEIGHT_PRESETS[preset];
    if (!selected) throw new RangeError(`Unknown continuation weight preset: ${preset}`);
    return Object.freeze({ preset, weights: validateWeights(selected) });
  }
  if (weights == null) {
    throw new TypeError("explicit weights or a named preset are required; there is no hidden default ranking");
  }
  return Object.freeze({ preset: null, weights: validateWeights(weights) });
}

function validateScoredCandidate(entry, index) {
  if (!entry || typeof entry !== "object" || !entry.candidate || !entry.dimensions) {
    throw new TypeError(`scoredCandidates[${index}] must be an HHF-020 scored-candidate object`);
  }
  continuationCandidateKey(entry.candidate);
  for (const dimension of CONTINUATION_SCORE_DIMENSIONS) {
    const record = entry.dimensions[dimension];
    if (!record || typeof record !== "object" || typeof record.available !== "boolean") {
      throw new TypeError(`scoredCandidates[${index}].dimensions.${dimension} is invalid`);
    }
    if (record.available) {
      const score = Number(record.score);
      if (!Number.isFinite(score) || score < 0 || score > 1) {
        throw new RangeError(`available ${dimension} score must be in [0,1]`);
      }
    }
  }
  return entry;
}

function scoreOne(entry, requestedWeights, missingPolicy) {
  const positiveDimensions = CONTINUATION_SCORE_DIMENSIONS.filter((name) => requestedWeights[name] > 0);
  const missingWeightedDimensions = positiveDimensions.filter((name) => !entry.dimensions[name].available);
  if (missingPolicy === "require" && missingWeightedDimensions.length) return null;

  let denominator = 0;
  if (missingPolicy === "renormalize") {
    denominator = positiveDimensions
      .filter((name) => entry.dimensions[name].available)
      .reduce((sum, name) => sum + requestedWeights[name], 0);
  } else {
    denominator = positiveDimensions.reduce((sum, name) => sum + requestedWeights[name], 0);
  }
  if (denominator <= EPSILON) return null;

  const contributions = {};
  let combinedScore = 0;
  for (const dimension of CONTINUATION_SCORE_DIMENSIONS) {
    const requestedWeight = requestedWeights[dimension];
    const record = entry.dimensions[dimension];
    let effectiveWeight = 0;
    let weightedContribution = 0;
    if (requestedWeight > 0) {
      if (record.available) {
        effectiveWeight = requestedWeight / denominator;
        weightedContribution = Number(record.score) * effectiveWeight;
        combinedScore += weightedContribution;
      } else if (missingPolicy === "zero") {
        effectiveWeight = requestedWeight / denominator;
      }
    }
    contributions[dimension] = Object.freeze({
      available: record.available,
      rawScore: record.available ? Number(record.score) : null,
      requestedWeight,
      effectiveWeight,
      weightedContribution
    });
  }

  return Object.freeze({
    scoredCandidate: entry,
    candidate: entry.candidate,
    combinedScore: Math.max(0, Math.min(1, combinedScore)),
    contributions: Object.freeze(contributions),
    missingWeightedDimensions: Object.freeze(missingWeightedDimensions),
    availableWeightedDimensions: Object.freeze(positiveDimensions.filter((name) => entry.dimensions[name].available)),
    missingPolicy,
    evidenceClass: "user-weighted-composite",
    note: "User-weighted objective score; not probability, correctness, or a universal best-chord measure."
  });
}

export function rankContinuationCandidates(scoredCandidates, {
  weights = null,
  preset = null,
  missingPolicy = "renormalize",
  limit = null
} = {}) {
  if (!Array.isArray(scoredCandidates)) throw new TypeError("scoredCandidates must be an array");
  if (!MISSING_POLICIES.has(missingPolicy)) throw new RangeError(`Unsupported missingPolicy: ${missingPolicy}`);
  const resolved = resolveContinuationWeights({ weights, preset });
  let resolvedLimit = scoredCandidates.length;
  if (limit != null) {
    resolvedLimit = Number(limit);
    if (!Number.isInteger(resolvedLimit) || resolvedLimit < 1) throw new RangeError("limit must be a positive integer");
  }

  const ranked = [];
  const excluded = [];
  scoredCandidates.forEach((raw, index) => {
    const entry = validateScoredCandidate(raw, index);
    const result = scoreOne(entry, resolved.weights, missingPolicy);
    if (result) ranked.push(result);
    else excluded.push(Object.freeze({
      candidate: entry.candidate,
      key: continuationCandidateKey(entry.candidate),
      reason: missingPolicy === "require"
        ? "one or more positively weighted dimensions are unavailable"
        : "no positively weighted dimensions are available for this candidate"
    }));
  });

  ranked.sort((a, b) =>
    b.combinedScore - a.combinedScore ||
    continuationCandidateKey(a.candidate).localeCompare(continuationCandidateKey(b.candidate))
  );

  const returned = ranked.slice(0, resolvedLimit).map((entry, index) => Object.freeze({ ...entry, rank: index + 1 }));
  return Object.freeze({
    preset: resolved.preset,
    requestedWeights: resolved.weights,
    missingPolicy,
    rankings: Object.freeze(returned),
    excluded: Object.freeze(excluded),
    candidateCount: scoredCandidates.length,
    eligibleCount: ranked.length,
    returnedCount: returned.length,
    truncated: ranked.length > resolvedLimit,
    evidenceClass: "user-weighted-composite",
    note: "Ordering follows the explicitly supplied weights/preset and missing-data policy. It is not a probability ranking."
  });
}
