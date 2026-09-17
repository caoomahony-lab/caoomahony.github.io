import { rankChordCandidates } from "../../theory/chords.js";
import { interpretChordUnderSystem } from "../../inference/function-engine.js";

export const FUNCTION_HEURISTIC_ID = "common-practice-role-flow-v0.1";

export const ROLE_TRANSITION_SUPPORT = Object.freeze({
  tonic: Object.freeze({ tonic: 0.55, predominant: 0.90, dominant: 0.75, modal: 0.65, chromatic: 0.45, ambiguous: 0.50 }),
  predominant: Object.freeze({ tonic: 0.45, predominant: 0.50, dominant: 0.95, modal: 0.55, chromatic: 0.45, ambiguous: 0.50 }),
  dominant: Object.freeze({ tonic: 1.00, predominant: 0.35, dominant: 0.40, modal: 0.45, chromatic: 0.35, ambiguous: 0.45 }),
  modal: Object.freeze({ tonic: 0.70, predominant: 0.65, dominant: 0.65, modal: 0.60, chromatic: 0.55, ambiguous: 0.55 }),
  chromatic: Object.freeze({ tonic: 0.65, predominant: 0.55, dominant: 0.65, modal: 0.55, chromatic: 0.50, ambiguous: 0.50 }),
  ambiguous: Object.freeze({ tonic: 0.60, predominant: 0.60, dominant: 0.60, modal: 0.55, chromatic: 0.50, ambiguous: 0.50 })
});

function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }

function chordCandidateFromContinuation(candidate) {
  if (candidate?.rootPc != null && candidate?.templateId) {
    return {
      rootPc: candidate.rootPc,
      templateId: candidate.templateId,
      quality: candidate.templateId,
      symbol: candidate.symbol ?? null,
      pitchClasses: [...candidate.pitchClasses],
      support: 1
    };
  }
  const ranked = rankChordCandidates(candidate?.pitchClasses ?? [], { limit: 1, minSupport: 0 });
  return ranked[0] ?? null;
}

export function scoreFunctionalContinuation(candidate, context = {}, options = {}) {
  if (!candidate || !Array.isArray(candidate.pitchClasses)) throw new TypeError("candidate must contain pitchClasses");
  if (context.centerPc == null || !context.systemId) {
    return Object.freeze({
      available: false,
      score: null,
      reason: "centerPc and systemId are required",
      evidenceClass: "heuristic",
      heuristicId: FUNCTION_HEURISTIC_ID
    });
  }

  const chordCandidate = chordCandidateFromContinuation(candidate);
  if (!chordCandidate) {
    return Object.freeze({
      available: false,
      score: null,
      reason: "candidate cannot be mapped to a chord template",
      evidenceClass: "heuristic",
      heuristicId: FUNCTION_HEURISTIC_ID
    });
  }

  const interpreted = interpretChordUnderSystem(chordCandidate, {
    centerPc: context.centerPc,
    systemId: context.systemId,
    systemSupport: clamp01(context.systemSupport ?? 0.75)
  });
  const previousRole = context.currentFunctionRole ?? "ambiguous";
  const row = ROLE_TRANSITION_SUPPORT[previousRole] ?? ROLE_TRANSITION_SUPPORT.ambiguous;
  const transitionSupport = row[interpreted.role] ?? 0.5;
  const membershipSupport = interpreted.membership;
  const chordRecognitionSupport = chordCandidate.support ?? 1;
  const weights = {
    membership: Number(options.membershipWeight ?? 0.45),
    transition: Number(options.transitionWeight ?? 0.40),
    recognition: Number(options.recognitionWeight ?? 0.15)
  };
  for (const [key, value] of Object.entries(weights)) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`${key} weight must be finite and nonnegative`);
  }
  const totalWeight = weights.membership + weights.transition + weights.recognition;
  if (totalWeight <= 0) throw new RangeError("functional score weights must sum to a positive value");
  const score = clamp01((
    weights.membership * membershipSupport +
    weights.transition * transitionSupport +
    weights.recognition * chordRecognitionSupport
  ) / totalWeight);

  return Object.freeze({
    available: true,
    score,
    role: interpreted.role,
    roman: interpreted.roman,
    nashville: interpreted.nashville,
    inSystem: interpreted.inSystem,
    membershipSupport,
    transitionSupport,
    chordRecognitionSupport,
    previousRole,
    heuristicId: FUNCTION_HEURISTIC_ID,
    evidenceClass: "heuristic",
    note: "Rule-based functional support, not corpus probability."
  });
}
