import { rankChordCandidates } from "../theory/chords.js";
import { analyzeHarmonicObjectSequence } from "../analysis/harmonic-objects.js";

export const AUDIO_HARMONY_VERSION = "audio-harmony-v1";

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function normalizeChroma(chroma) {
  const values = Array.from({ length: 12 }, (_, pc) => Math.max(0, Number(chroma?.[pc]) || 0));
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  return values.map((value) => value / total);
}

function activePitchClasses(chroma, options = {}) {
  const normalized = normalizeChroma(chroma);
  const max = Math.max(...normalized, 1e-12);
  const relativeFloor = Number(options.relativeFloor ?? 0.34);
  const maxPitchClasses = Math.max(3, Number(options.maxPitchClasses ?? 5));
  const ordered = normalized
    .map((strength, pc) => ({ pc, strength }))
    .sort((a, b) => b.strength - a.strength || a.pc - b.pc);
  const selected = ordered
    .filter((item, index) => index < maxPitchClasses && item.strength >= max * relativeFloor)
    .map((item) => item.pc);
  while (selected.length < Math.min(3, ordered.length)) selected.push(ordered[selected.length].pc);
  return Object.freeze([...new Set(selected)].sort((a, b) => a - b));
}

function candidateAudioSupport(candidate, chroma) {
  const normalized = normalizeChroma(chroma);
  const template = new Set(candidate.pitchClasses || []);
  const inside = normalized.reduce((sum, value, pc) => sum + (template.has(pc) ? value : 0), 0);
  const root = normalized[candidate.rootPc] || 0;
  const third = Math.max(normalized[(candidate.rootPc + 3) % 12] || 0, normalized[(candidate.rootPc + 4) % 12] || 0);
  const fifth = normalized[(candidate.rootPc + 7) % 12] || 0;
  return clamp01(0.56 * candidate.support + 0.22 * inside + 0.10 * root + 0.07 * third + 0.05 * fifth);
}

function frameCandidates(frame, options = {}) {
  const pcs = activePitchClasses(frame.chroma, options);
  const limit = Math.max(2, Number(options.candidateLimit ?? 5));
  const ranked = rankChordCandidates(pcs, { limit, minSupport: Number(options.minChordSupport ?? 0.18) })
    .map((candidate) => Object.freeze({
      ...candidate,
      audioSupport: candidateAudioSupport(candidate, frame.chroma),
      evidenceClass: "inferred-from-audio",
      bassPc: null,
      bassEvidence: "unavailable-from-chroma-v1"
    }))
    .sort((a, b) => b.audioSupport - a.audioSupport || b.support - a.support || a.symbol.localeCompare(b.symbol));
  return Object.freeze(ranked);
}

function viterbiPath(frames, candidatesByFrame, options = {}) {
  const changePenalty = Number(options.changePenalty ?? 0.095);
  const rootChangePenalty = Number(options.rootChangePenalty ?? 0.02);
  const scores = [];
  const back = [];

  for (let i = 0; i < frames.length; i += 1) {
    const states = candidatesByFrame[i];
    scores[i] = Array(states.length).fill(-Infinity);
    back[i] = Array(states.length).fill(-1);
    for (let s = 0; s < states.length; s += 1) {
      const emission = states[s].audioSupport;
      if (i === 0) {
        scores[i][s] = emission;
        continue;
      }
      const prevStates = candidatesByFrame[i - 1];
      for (let p = 0; p < prevStates.length; p += 1) {
        const same = prevStates[p].symbol === states[s].symbol;
        const rootChanged = prevStates[p].rootPc !== states[s].rootPc;
        const transitionPenalty = same ? 0 : changePenalty + (rootChanged ? rootChangePenalty : 0);
        const value = scores[i - 1][p] + emission - transitionPenalty;
        if (value > scores[i][s]) {
          scores[i][s] = value;
          back[i][s] = p;
        }
      }
    }
  }

  let state = scores.at(-1).reduce((best, value, index, arr) => value > arr[best] ? index : best, 0);
  const path = Array(frames.length);
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    path[i] = state;
    state = back[i][state] >= 0 ? back[i][state] : 0;
  }
  return path;
}

function labelRuns(path, candidatesByFrame) {
  const labels = path.map((state, i) => candidatesByFrame[i][state]?.symbol || "—");
  const runs = [];
  for (let i = 0; i < labels.length; i += 1) {
    if (!runs.length || runs.at(-1).label !== labels[i]) runs.push({ label: labels[i], start: i, end: i + 1 });
    else runs.at(-1).end = i + 1;
  }
  return runs;
}

function suppressShortRuns(path, candidatesByFrame, minFrames) {
  const labels = path.map((state, i) => candidatesByFrame[i][state]?.symbol || "—");
  const runs = labelRuns(path, candidatesByFrame);
  for (let r = 0; r < runs.length; r += 1) {
    const run = runs[r];
    if (run.end - run.start >= minFrames) continue;
    const previous = r > 0 ? runs[r - 1] : null;
    const next = r + 1 < runs.length ? runs[r + 1] : null;
    let replacement = null;
    if (previous && next && previous.label === next.label) replacement = previous.label;
    else if (previous && next) replacement = (previous.end - previous.start) >= (next.end - next.start) ? previous.label : next.label;
    else replacement = previous?.label || next?.label || null;
    if (!replacement) continue;
    for (let i = run.start; i < run.end; i += 1) labels[i] = replacement;
  }
  return labels;
}

function aggregateChroma(frames, start, end) {
  const aggregate = Array(12).fill(0);
  for (let i = start; i < end; i += 1) {
    for (let pc = 0; pc < 12; pc += 1) aggregate[pc] += Number(frames[i].chroma?.[pc] || 0);
  }
  const count = Math.max(1, end - start);
  return aggregate.map((value) => value / count);
}

function softmax(values, temperature = 0.045) {
  if (!values.length) return [];
  const max = Math.max(...values);
  const exps = values.map((value) => Math.exp((value - max) / temperature));
  const total = exps.reduce((sum, value) => sum + value, 0) || 1;
  return exps.map((value) => value / total);
}

function buildSegments(frames, labels, hopSeconds, options = {}) {
  const runs = [];
  for (let i = 0; i < labels.length; i += 1) {
    if (!runs.length || runs.at(-1).label !== labels[i]) runs.push({ label: labels[i], start: i, end: i + 1 });
    else runs.at(-1).end = i + 1;
  }

  return Object.freeze(runs.map((run, index) => {
    const chroma = aggregateChroma(frames, run.start, run.end);
    const pcs = activePitchClasses(chroma, options);
    const candidates = rankChordCandidates(pcs, { limit: Math.max(2, Number(options.segmentCandidateLimit ?? 4)), minSupport: 0.16 })
      .map((candidate) => ({
        ...candidate,
        audioSupport: candidateAudioSupport(candidate, chroma),
        evidenceClass: "inferred-from-audio",
        bassPc: null,
        bassEvidence: "unavailable-from-chroma-v1"
      }))
      .sort((a, b) => b.audioSupport - a.audioSupport || b.support - a.support || a.symbol.localeCompare(b.symbol));
    const preferredIndex = candidates.findIndex((candidate) => candidate.symbol === run.label);
    if (preferredIndex > 0) {
      const [preferred] = candidates.splice(preferredIndex, 1);
      candidates.unshift(preferred);
    }
    const weights = softmax(candidates.map((candidate) => candidate.audioSupport));
    const weighted = Object.freeze(candidates.map((candidate, candidateIndex) => Object.freeze({
      ...candidate,
      relativeWeight: weights[candidateIndex]
    })));
    const onset = Number(frames[run.start].time || 0);
    const end = Number(frames[Math.max(run.start, run.end - 1)].time || onset) + hopSeconds;
    const top = weighted[0] || null;
    return Object.freeze({
      index,
      onset,
      end,
      duration: Math.max(hopSeconds, end - onset),
      symbol: top?.symbol || run.label,
      rootPc: top?.rootPc ?? null,
      templateId: top?.templateId ?? null,
      pcs: Object.freeze(top?.pitchClasses ? [...top.pitchClasses] : [...pcs]),
      observedPitchClasses: pcs,
      chroma: Object.freeze(chroma),
      candidates: weighted,
      support: top?.audioSupport ?? 0,
      ambiguity: weighted.length > 1 ? clamp01(1 - (weighted[0].relativeWeight - weighted[1].relativeWeight)) : 0,
      bassPc: null,
      bassEvidence: "unavailable-from-chroma-v1",
      evidenceClass: "inferred-from-audio"
    });
  }));
}

export function inferAudioHarmonySegments(framesRaw, hopSecondsRaw, options = {}) {
  if (!Array.isArray(framesRaw) || !framesRaw.length) throw new TypeError("frames must be a nonempty array");
  const hopSeconds = Number(hopSecondsRaw);
  if (!Number.isFinite(hopSeconds) || hopSeconds <= 0) throw new TypeError("hopSeconds must be positive");
  const frames = framesRaw.map((frame) => ({ time: Number(frame.time) || 0, chroma: normalizeChroma(frame.chroma) }));
  const candidatesByFrame = frames.map((frame) => frameCandidates(frame, options));
  if (candidatesByFrame.some((candidates) => !candidates.length)) throw new Error("audio frames did not produce chord candidates");
  const path = viterbiPath(frames, candidatesByFrame, options);
  const minFrames = Math.max(1, Math.round(Number(options.minSegmentSeconds ?? 0.72) / hopSeconds));
  const labels = suppressShortRuns(path, candidatesByFrame, minFrames);
  const segments = buildSegments(frames, labels, hopSeconds, options);
  const sequence = segments.map((segment) => ({ pcs: segment.pcs, bassPc: null, weight: segment.duration }));
  let harmonicAnalysis = null;
  try {
    harmonicAnalysis = sequence.length ? analyzeHarmonicObjectSequence(sequence) : null;
  } catch {
    harmonicAnalysis = null;
  }
  return Object.freeze({
    version: AUDIO_HARMONY_VERSION,
    evidenceClass: "inferred-from-audio",
    bassEvidence: "unavailable-from-chroma-v1",
    frameCount: frames.length,
    segmentCount: segments.length,
    segments,
    harmonicAnalysis,
    note: "Chord boundaries, roots, and qualities are inferred from chroma over time; bass identity is not measured by this layer."
  });
}
