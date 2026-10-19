import { buildContinuationSession } from "./session.js";
import { continuationCandidateKey } from "./scores/evidence-score.js";
import { rankCompositionContinuations } from "./composition-score.js";
import { parseChordSequence } from "../input/chord-sequence.js";
import { searchPassages } from "../analysis/composition-context.js";

export const WORKBENCH_VERSION = "song-workbench-v1";

// Bounded local work, shared by the worker and regression tests. No empirical
// frequency/style evidence is invented when a corpus/model is unavailable.
export function analyzeWorkbench(options = {}) {
  const sourceVoicing=options.compositionContext?.features?.selectedVoicing;
  const session = buildContinuationSession({ ...options,
    ...(options.compositionContext?.mode === "compose-forward" ? {activeField:null,shadowField:null} : {}),
    currentVoicing: options.currentVoicing || (sourceVoicing?.length && sourceVoicing.length<=6 ? sourceVoicing.join(" ") : ""),
    candidateOptions: { maxCandidates: 192 },
    scoringOptions: { voiceLeading: { ...(options.voicingPolicy||{}), maxVoicingCandidates: 40, maxSearchNodes: 1800 } }
  });
  return options.compositionContext ? Object.freeze({...session,composition:rankCompositionContinuations(session,options.compositionContext,options)}) : session;
}

export function orderedContinuations(session, limit = 6) {
  if(session.composition) return session.composition.ranking.slice(0,limit).map(rank=>({
    entry:session.candidates.find(entry=>entry.candidate===rank.candidate||continuationCandidateKey(entry.candidate)===continuationCandidateKey(rank.candidate)),
    rank:{combinedScore:rank.score,composition:rank}
  })).filter(item=>item.entry);
  const byKey = new Map(session.candidates.map(entry => [continuationCandidateKey(entry.candidate), entry]));
  // Candidate object identity survives structured clone, but the fallback key
  // also supports sessions read from an exported JSON file.
  return session.ranking ? session.ranking.rankings.slice(0, limit).map(rank => ({
    entry: session.candidates.find(item => item.candidate === rank.candidate) ||
      byKey.get(continuationCandidateKey(rank.candidate)), rank
  })).filter(item => item.entry) : session.candidates.slice(0, limit).map(entry => ({ entry, rank: null }));
}

export function processWorkbenchRequest({ type = "analyze", options = {}, chord = null, query = null, sources = null } = {}) {
  if(type === "passage-search") return {version:WORKBENCH_VERSION,matches:searchPassages(query,sources)};
  if (type === "analyze") return { version: WORKBENCH_VERSION, session: analyzeWorkbench(options) };
  if (type !== "branch" || typeof chord !== "string" || !chord) throw new TypeError("Unknown workbench request");
  const session = analyzeWorkbench({ ...options, progression: `${options.progression} | ${chord}`,
    // The actual song voicing belongs to the selected chord, not to this
    // hypothetical next chord. Do not reuse it as if it had been performed.
    currentVoicing: "", targetTonic: "", compositionContext: branchContext(options.compositionContext,chord) });
  return { version: WORKBENCH_VERSION, hypothetical: true, chord, context: session.context,
    continuations: orderedContinuations(session, 3).map(({ entry, rank }) => ({
      symbol: entry.presentation.symbol, roman: entry.presentation.roman,
      explanation: entry.presentation.beginner, score: rank?.combinedScore ?? null
    })) };
}

// Generated branch material is distinct from source evidence. Update only the
// hypothetical current chord; never relabel generated material as measured.
function branchContext(context,chord) {
  if(!context)return null;
  const parsed=parseChordSequence(chord).currentChord;
  const pcs=parsed.pitchClasses;
  return {...context,features:{...context.features,currentPitchClasses:pcs,currentRoot:parsed.rootPc,selectedVoicing:null},
    branch:{symbol:chord,pitchClasses:pcs,evidenceClass:"hypothetical-generated"}};
}
