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

function bestChordCandidate(candidates) {
  return candidates.find((candidate) => candidate.exact) || candidates[0] || null;
}

function tonicThirdCompatibility(candidate, system) {
  if (!candidate) return 0;
  const systemHasMinorThird = system.intervals.includes(3);
  const systemHasMajorThird = system.intervals.includes(4);
  const intervals = new Set(candidate.intervals || []);
  const chordHasMinorThird = intervals.has(3);
  const chordHasMajorThird = intervals.has(4);
  if (systemHasMajorThird && !systemHasMinorThird) return chordHasMajorThird && !chordHasMinorThird ? 1 : 0;
  if (systemHasMinorThird && !systemHasMajorThird) return chordHasMinorThird && !chordHasMajorThird ? 1 : 0;
  return 0.5;
}

function chordMembership(candidate, systemPcs) {
  if (!candidate?.pitchClasses?.length) return 0;
  return candidate.pitchClasses.filter((pc) => systemPcs.has(mod12(pc))).length / candidate.pitchClasses.length;
}

function isDominantQuality(candidate) {
  return candidate != null && ["major", "dominant7", "dominant9"].includes(candidate.templateId);
}

function sequenceSyntaxSupport(chords, chordCandidates, centerPc, system) {
  const center = mod12(centerPc);
  const systemPcs = new Set(system.intervals.map((interval) => mod12(center + interval)));
  const best = chordCandidates.map(bestChordCandidate);
  let centerAnchor = 0;
  let boundaryAnchor = 0;
  let resolvedDominant = 0;
  let centerQualityConflict = 0;
  let rootedWeight = 0;
  let rootInSystemWeight = 0;

  for (let index = 0; index < best.length; index += 1) {
    const candidate = best[index];
    if (!candidate) continue;
    const chordWeight = chords[index].weight;
    rootedWeight += chordWeight;
    if (systemPcs.has(candidate.rootPc)) rootInSystemWeight += chordWeight;

    if (candidate.rootPc === center) {
      const compatibility = tonicThirdCompatibility(candidate, system);
      const positionalWeight = index === 0 ? 1 : index === best.length - 1 ? 0.65 : 0.72;
      if (compatibility > 0) {
        centerAnchor = Math.max(centerAnchor, compatibility * candidate.support * positionalWeight);
        if (index === 0) {
          boundaryAnchor = Math.max(boundaryAnchor, compatibility * candidate.support);
        } else if (index === best.length - 1) {
          boundaryAnchor = Math.max(boundaryAnchor, 0.55 * compatibility * candidate.support);
        }
      } else if (candidate.support >= 0.9) {
        centerQualityConflict = Math.max(centerQualityConflict, candidate.support * positionalWeight);
      }
    }

    if (index >= best.length - 1 || !isDominantQuality(candidate)) continue;
    const target = best[index + 1];
    if (!target || mod12(target.rootPc - candidate.rootPc) !== 5) continue;
    if (!systemPcs.has(target.rootPc)) continue;
    const targetMembership = chordMembership(target, systemPcs);
    if (targetMembership < 0.6) continue;
    const destinationStrength = target.rootPc === center ? 1 : 0.55;
    const membershipStrength = 0.6 + 0.4 * targetMembership;
    resolvedDominant = Math.max(resolvedDominant, destinationStrength * membershipStrength * candidate.support * target.support);
  }

  const rootInSystemShare = rootedWeight > 0 ? rootInSystemWeight / rootedWeight : 0;
  const support = clamp01(
    0.47 * centerAnchor +
    0.34 * resolvedDominant +
    0.14 * boundaryAnchor +
    0.05 * rootInSystemShare -
    0.18 * centerQualityConflict
  );

  return Object.freeze({
    support,
    centerAnchor,
    resolvedDominant,
    boundaryAnchor,
    rootInSystemShare,
    centerQualityConflict,
    evidenceClass: "inferred-syntactic"
  });
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
    const syntax = sequenceSyntaxSupport(chords, chordCandidates, scale.rootPc, systemById(scale.systemId));
    const support = clamp01(0.36 * scale.support + 0.46 * meanFunctionSupport + 0.18 * syntax.support);
    hypotheses.push({
      centerPc: scale.rootPc,
      systemId: scale.systemId,
      systemName: scale.scale,
      scaleSupport: scale.support,
      meanFunctionSupport,
      syntaxSupport: syntax.support,
      syntaxEvidence: syntax,
      support,
      functions: Object.freeze(functions)
    });
  }

  hypotheses.sort((a,b) => b.support - a.support || b.syntaxSupport - a.syntaxSupport || b.scaleSupport - a.scaleSupport || a.centerPc - b.centerPc);
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
