import { buildContinuationSession } from "./session.js";
import { continuationCandidateKey } from "./scores/evidence-score.js";

export const WORKBENCH_VERSION = "song-workbench-v1";

// Bounded local work, shared by the worker and regression tests. No empirical
// frequency/style evidence is invented when a corpus/model is unavailable.
export function analyzeWorkbench(options = {}) {
  return buildContinuationSession({ ...options,
    candidateOptions: { maxCandidates: 192 },
    scoringOptions: { voiceLeading: { maxVoicingCandidates: 40, maxSearchNodes: 1800 } }
  });
}

export function orderedContinuations(session, limit = 6) {
  const byKey = new Map(session.candidates.map(entry => [continuationCandidateKey(entry.candidate), entry]));
  // Candidate object identity survives structured clone, but the fallback key
  // also supports sessions read from an exported JSON file.
  return session.ranking ? session.ranking.rankings.slice(0, limit).map(rank => ({
    entry: session.candidates.find(item => item.candidate === rank.candidate) ||
      byKey.get(continuationCandidateKey(rank.candidate)), rank
  })).filter(item => item.entry) : session.candidates.slice(0, limit).map(entry => ({ entry, rank: null }));
}

export function processWorkbenchRequest({ type = "analyze", options = {}, chord = null } = {}) {
  if (type === "analyze") return { version: WORKBENCH_VERSION, session: analyzeWorkbench(options) };
  if (type !== "branch" || typeof chord !== "string" || !chord) throw new TypeError("Unknown workbench request");
  const session = analyzeWorkbench({ ...options, progression: `${options.progression} | ${chord}`,
    // The actual song voicing belongs to the selected chord, not to this
    // hypothetical next chord. Do not reuse it as if it had been performed.
    currentVoicing: "", targetTonic: "" });
  return { version: WORKBENCH_VERSION, hypothetical: true, chord, context: session.context,
    continuations: orderedContinuations(session, 3).map(({ entry, rank }) => ({
      symbol: entry.presentation.symbol, roman: entry.presentation.roman,
      explanation: entry.presentation.beginner, score: rank?.combinedScore ?? null
    })) };
}
