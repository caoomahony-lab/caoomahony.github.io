import { rankChordCandidates } from "../theory/chords.js";
import { interpretChordSequence } from "../inference/function-engine.js";
import { extractChordVocabulary } from "../fingerprint/blocks/chord-vocabulary.js";
import { extractRootMotion } from "../fingerprint/blocks/root-motion.js";
import { extractChordTransitions } from "../fingerprint/blocks/transitions.js";
import { extractModalProfile } from "../fingerprint/blocks/modal-profile.js";

function normalizeEntry(entry) {
  if (Array.isArray(entry)) return { pcs: entry, bassPc: null, weight: 1 };
  if (!entry || !Array.isArray(entry.pcs)) throw new TypeError("sequence entries must be arrays or {pcs,bassPc,weight}");
  const weight = Number(entry.weight ?? entry.durationSec ?? 1);
  return { pcs: entry.pcs, bassPc: entry.bassPc ?? null, weight: Number.isFinite(weight) && weight > 0 ? weight : 1 };
}

export function analyzeHarmonicObjectSequence(sequence, options = {}) {
  if (!Array.isArray(sequence) || !sequence.length) throw new TypeError("sequence must be a nonempty array");
  const entries = sequence.map(normalizeEntry);
  const chordVocabulary = extractChordVocabulary(entries, options.chordVocabulary);
  const contextual = interpretChordSequence(entries, options.functionEngine);

  const rootStates = entries.map((entry) => {
    const best = rankChordCandidates(entry.pcs, { bassPc: entry.bassPc, limit: 1 })[0] || null;
    return best ? { rootPc: best.rootPc, weight: entry.weight, support: best.support } : null;
  }).filter(Boolean);
  const rootMotion = extractRootMotion(rootStates);

  const bestHypothesis = contextual.hypotheses[0] || null;
  const functionStates = bestHypothesis
    ? bestHypothesis.functions.map((entry, index) => {
        const best = entry.candidates[0];
        return best ? { ...best, weight: entries[index].weight } : null;
      }).filter(Boolean)
    : [];
  const chordTransitions = extractChordTransitions(functionStates);

  const modalProfile = extractModalProfile([
    { candidates: contextual.hypotheses.map((hypothesis) => ({
      rootPc: hypothesis.centerPc,
      systemId: hypothesis.systemId,
      support: hypothesis.support,
      relativeWeight: hypothesis.relativeWeight
    })) }
  ], { referenceCenterPc: bestHypothesis?.centerPc ?? null });

  return Object.freeze({
    chordVocabulary,
    contextualFunction: contextual,
    rootMotion,
    chordTransitions,
    modalProfile,
    evidenceClasses: Object.freeze({
      chordVocabulary: "mixed-deterministic-and-inferred",
      contextualFunction: "inferred",
      rootMotion: "deterministic-under-inferred-roots",
      chordTransitions: "deterministic-under-inferred-functions",
      modalProfile: "inferred-summary"
    })
  });
}
