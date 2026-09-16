import { mod12 } from "../theory/pitch.js";
import { rankChordCandidates } from "../theory/chords.js";
import { degreeDescriptor, romanNumeralForChord, nashvilleNumberForChord } from "../theory/functions.js";
import { inferScaleCandidates, SCALE_SYSTEMS } from "./scales.js";

function clamp01(value) { return Math.max(0, Math.min(1, value)); }

function normalizeChordInput(chord) {
  if (Array.isArray(chord)) return { pcs: chord, bassPc: null, weight: 1 };
  if (!chord || !Array.isArray(chord.pcs)) throw new TypeError("each chord must be a pitch-class array or {pcs,bassPc,weight}");
  return { pcs: chord.pcs, bassPc: chord.bassPc ?? null, weight: Number.isFinite(Number(chord.weight)) && Number(chord.weight) > 0 ? Number(chord.weight) : 1 };
}

function systemById(id) { return SCALE_SYSTEMS.find((system) => system.id === id) || null; }

function roleFor(relativeSemitones, inSystem) {
  if (!inSystem) return "chromatic";
  const relative = mod12(relativeSemitones);
  if (relative === 0) return "tonic";
  if (relative === 2 || relative === 5) return "predominant";
  if (relative === 7 || relative === 11) return "dominant";
  if ([1,3,6,8,10].includes(relative)) return "modal";
  return "ambiguous";
}

export function interpretChordUnderSystem(chordCandidate, { centerPc, systemId, systemSupport = 0.5 }) {
  const system = systemById(systemId);
  if (!system) throw new RangeError(`Unknown systemId: ${systemId}`);
  const center = mod12(centerPc);
  const systemPcs = new Set(system.intervals.map((interval) => mod12(center + interval)));
  const inSystemCount = chordCandidate.pitchClasses.filter((pc) => systemPcs.has(pc)).length;
  const membership = chordCandidate.pitchClasses.length ? inSystemCount / chordCandidate.pitchClasses.length : 0;
  const rootInSystem = systemPcs.has(chordCandidate.rootPc);
  const relativeSemitones = mod12(chordCandidate.rootPc - center);
  const degree = degreeDescriptor(relativeSemitones);
  const inSystem = membership >= 0.999999 && rootInSystem;
  const role = roleFor(relativeSemitones, inSystem);
  const support = clamp01(0.50 * chordCandidate.support + 0.28 * membership + 0.12 * (rootInSystem ? 1 : 0) + 0.10 * systemSupport);
  return Object.freeze({
    centerPc: center,
    systemId,
    systemName: system.name,
    rootPc: chordCandidate.rootPc,
    templateId: chordCandidate.templateId,
    chordSymbol: chordCandidate.symbol,
    relativeSemitones,
    degreeNumber: degree.degreeNumber,
    degreeAccidental: degree.accidental,
    degreeLabel: degree.label,
    roman: romanNumeralForChord(chordCandidate, center),
    nashville: nashvilleNumberForChord(chordCandidate, center),
    role,
    inSystem,
    membership,
    chordSupport: chordCandidate.support,
    systemSupport,
    support,
    evidenceClass: "inferred"
  });
}

function activityFromSequence(chords) {
  const activity = Array(12).fill(0);
  for (const chord of chords) {
    const unique = [...new Set(chord.pcs.map(mod12))];
    const share = chord.weight / Math.max(1, unique.length);
    for (const pc of unique) activity[pc] += share;
  }
  return activity;
}

function softmax(values, temperature = 0.08) {
  if (!values.length) return [];
  const max = Math.max(...values);
  const exps = values.map((value) => Math.exp((value - max) / temperature));
  const sum = exps.reduce((a,b) => a + b, 0) || 1;
  return exps.map((value) => value / sum);
}

export function interpretChordSequence(sequence, { hypothesisLimit = 8, chordCandidateLimit = 6, functionCandidateLimit = 6 } = {}) {
  if (!Array.isArray(sequence) || !sequence.length) throw new TypeError("sequence must be a nonempty array");
  const chords = sequence.map(normalizeChordInput);
  const activity = activityFromSequence(chords);
  const scaleHypotheses = inferScaleCandidates(activity, { limit: Math.max(hypothesisLimit * 2, 12) });
  const chordCandidates = chords.map((chord) => rankChordCandidates(chord.pcs, { bassPc: chord.bassPc, limit: chordCandidateLimit, minSupport: 0.20 }));
  const hypotheses = [];

  for (const scale of scaleHypotheses) {
    const functions = [];
    let weightedSupport = 0;
    let totalWeight = 0;
    for (let index = 0; index < chords.length; index += 1) {
      const options = chordCandidates[index]
        .map((candidate) => interpretChordUnderSystem(candidate, { centerPc: scale.rootPc, systemId: scale.systemId, systemSupport: scale.support }))
        .sort((a,b) => b.support - a.support)
        .slice(0, functionCandidateLimit);
      const best = options[0] || null;
      functions.push(Object.freeze({ index, candidates: Object.freeze(options) }));
      if (best) {
        weightedSupport += best.support * chords[index].weight;
        totalWeight += chords[index].weight;
      }
    }
    const meanFunctionSupport = totalWeight > 0 ? weightedSupport / totalWeight : 0;
    const support = clamp01(0.42 * scale.support + 0.58 * meanFunctionSupport);
    hypotheses.push({ centerPc: scale.rootPc, systemId: scale.systemId, systemName: scale.scale, scaleSupport: scale.support, meanFunctionSupport, support, functions: Object.freeze(functions) });
  }

  hypotheses.sort((a,b) => b.support - a.support || b.scaleSupport - a.scaleSupport || a.centerPc - b.centerPc);
  const top = hypotheses.slice(0, hypothesisLimit);
  const weights = softmax(top.map((hypothesis) => hypothesis.support));
  const weightedHypotheses = Object.freeze(top.map((hypothesis, index) => Object.freeze({ ...hypothesis, relativeWeight: weights[index] })));

  const chordInterpretations = Object.freeze(chords.map((chord, chordIndex) => {
    const all = [];
    for (const hypothesis of weightedHypotheses) {
      const local = hypothesis.functions[chordIndex]?.candidates || [];
      for (const candidate of local) all.push(Object.freeze({ ...candidate, hypothesisWeight: hypothesis.relativeWeight }));
    }
    all.sort((a,b) => (b.support * b.hypothesisWeight) - (a.support * a.hypothesisWeight));
    return Object.freeze({ index: chordIndex, pitchClasses: Object.freeze([...new Set(chord.pcs.map(mod12))].sort((a,b) => a-b)), candidates: Object.freeze(all.slice(0, functionCandidateLimit)) });
  }));

  return Object.freeze({ hypotheses: weightedHypotheses, chords: chordInterpretations, evidenceClass: "inferred" });
}
