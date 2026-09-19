import { rankChordCandidates } from "../theory/chords.js";
import { selectAdaptivePitchClasses } from "../music/audio-pitch-evidence.js";

export const HARMONIC_REGION_VERSION = "harmonic-regions-v2";

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function normalizedChroma(chroma) {
  const values = Array.from({ length: 12 }, (_, pc) => Math.max(0, Number(chroma?.[pc]) || 0));
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  return values.map((value) => value / total);
}

function cosineSimilarity(aRaw, bRaw) {
  const a = normalizedChroma(aRaw);
  const b = normalizedChroma(bRaw);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let pc = 0; pc < 12; pc += 1) {
    dot += a[pc] * b[pc];
    normA += a[pc] * a[pc];
    normB += b[pc] * b[pc];
  }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

function pitchSet(segment) {
  return new Set(segment.observedPitchClasses || segment.pcs || []);
}

function jaccardSimilarity(aSegment, bSegment) {
  const a = pitchSet(aSegment);
  const b = pitchSet(bSegment);
  const union = new Set([...a, ...b]);
  if (!union.size) return 0;
  let intersection = 0;
  for (const pc of a) if (b.has(pc)) intersection += 1;
  return intersection / union.size;
}

function chordFamily(templateId) {
  if (["major", "major6", "major7", "add9", "dominant7", "dominant9", "major9", "sus2", "sus4", "power"].includes(templateId)) {
    return "major-root-family";
  }
  if (["minor", "minor6", "minor7", "minorAdd9", "minor9", "minorMajor7", "halfDiminished7"].includes(templateId)) {
    return "minor-root-family";
  }
  return templateId || "unknown";
}

function supportedRoots(segment) {
  const roots = new Set();
  if (segment.rootPc != null) roots.add(Number(segment.rootPc));
  for (const candidate of (segment.candidates || []).slice(0, 3)) {
    if (candidate.rootPc != null && Number(candidate.relativeWeight ?? 1) >= 0.12) roots.add(Number(candidate.rootPc));
  }
  return roots;
}

function sharesCandidateRoot(a, b) {
  const aRoots = supportedRoots(a);
  const bRoots = supportedRoots(b);
  for (const root of aRoots) if (bRoots.has(root)) return true;
  return false;
}

function mergeEvidence(a, b, options) {
  const cosine = cosineSimilarity(a.chroma, b.chroma);
  const jaccard = jaccardSimilarity(a, b);
  const sameRoot = a.rootPc != null && b.rootPc != null && Number(a.rootPc) === Number(b.rootPc);
  const sameTemplate = Boolean(a.templateId && a.templateId === b.templateId);
  const compatibleFamily = chordFamily(a.templateId) === chordFamily(b.templateId);
  const sharedRootEvidence = sharesCandidateRoot(a, b);
  const cosineThreshold = Number(options.cosineThreshold ?? 0.86);
  const pitchOverlapThreshold = Number(options.pitchOverlapThreshold ?? 0.6);

  let merge = false;
  let reason = "incompatible";
  if (sameRoot && sameTemplate) {
    merge = true;
    reason = "same-root-and-template";
  } else if (sameRoot && compatibleFamily && (cosine >= 0.72 || jaccard >= 0.5)) {
    merge = true;
    reason = "same-root-compatible-family";
  } else if (sameRoot && sharedRootEvidence && cosine >= cosineThreshold && jaccard >= pitchOverlapThreshold) {
    merge = true;
    reason = "same-root-spectral-and-pitch-overlap";
  }

  return Object.freeze({ merge, reason, cosine, jaccard, sameRoot, compatibleFamily, sharedRootEvidence });
}

function weightedChroma(segments) {
  const aggregate = Array(12).fill(0);
  let totalWeight = 0;
  for (const segment of segments) {
    const weight = Math.max(0, Number(segment.duration) || Math.max(0, Number(segment.end) - Number(segment.onset)) || 1);
    const chroma = normalizedChroma(segment.chroma);
    for (let pc = 0; pc < 12; pc += 1) aggregate[pc] += chroma[pc] * weight;
    totalWeight += weight;
  }
  return Object.freeze(aggregate.map((value) => value / (totalWeight || 1)));
}

function activePitchClasses(chroma, options) {
  return selectAdaptivePitchClasses(chroma, options);
}

function aggregateRegionBass(segments, options) {
  const votes = Array(12).fill(0);
  let totalDuration = 0;
  let evidenceDuration = 0;
  for (const segment of segments) {
    const duration = Math.max(0, Number(segment.duration) || Number(segment.end) - Number(segment.onset));
    totalDuration += duration;
    if (segment.bassPc == null) continue;
    const confidence = Math.max(0.05, Number(segment.bassConfidence || 0));
    votes[((Number(segment.bassPc) % 12) + 12) % 12] += duration * confidence;
    evidenceDuration += duration;
  }
  const coverage = totalDuration > 0 ? evidenceDuration / totalDuration : 0;
  const totalVote = votes.reduce((sum, value) => sum + value, 0);
  const winner = votes.reduce((best, value, pc, array) => value > array[best] ? pc : best, 0);
  const share = totalVote > 0 ? votes[winner] / totalVote : 0;
  const minimumCoverage = Number(options.regionBassMinimumCoverage ?? 0.25);
  const minimumShare = Number(options.regionBassMinimumShare ?? 0.55);
  return Object.freeze({
    bassPc: coverage >= minimumCoverage && share >= minimumShare ? winner : null,
    confidence: coverage * share,
    coverage,
    share
  });
}

function relativeWeights(values, temperature = 0.08) {
  if (!values.length) return [];
  const max = Math.max(...values);
  const exps = values.map((value) => Math.exp((value - max) / temperature));
  const total = exps.reduce((sum, value) => sum + value, 0) || 1;
  return exps.map((value) => value / total);
}

function provisionalGroups(segments, options) {
  const groups = [];
  for (const segment of segments) {
    const group = groups.at(-1);
    if (!group) {
      groups.push({ segments: [segment], mergeReasons: [] });
      continue;
    }
    const evidence = mergeEvidence(group.segments.at(-1), segment, options);
    if (evidence.merge) {
      group.segments.push(segment);
      group.mergeReasons.push(evidence);
    } else {
      groups.push({ segments: [segment], mergeReasons: [] });
    }
  }
  return groups;
}

function absorbAmbiguousBridges(groups, options) {
  const bridgeMaxSeconds = Number(options.bridgeMaxSeconds ?? 0.9);
  const bridgeAmbiguity = Number(options.bridgeAmbiguity ?? 0.55);
  const output = [];
  for (let index = 0; index < groups.length; index += 1) {
    const left = output.at(-1);
    const bridge = groups[index];
    const right = groups[index + 1];
    if (left && right && bridge.segments.length === 1) {
      const segment = bridge.segments[0];
      const duration = Math.max(0, Number(segment.duration) || Number(segment.end) - Number(segment.onset));
      const flankEvidence = mergeEvidence(left.segments.at(-1), right.segments[0], options);
      if (
        duration <= bridgeMaxSeconds &&
        Number(segment.ambiguity ?? 0) >= bridgeAmbiguity &&
        flankEvidence.merge &&
        flankEvidence.sameRoot
      ) {
        left.segments.push(segment, ...right.segments);
        left.mergeReasons.push(
          Object.freeze({
            reason: "short-ambiguous-bridge-between-compatible-flanks",
            bridgeIndex: segment.index,
            flankCosine: flankEvidence.cosine,
            flankJaccard: flankEvidence.jaccard
          }),
          ...right.mergeReasons
        );
        index += 1;
        continue;
      }
    }
    output.push({ segments: [...bridge.segments], mergeReasons: [...bridge.mergeReasons] });
  }
  return output;
}

function makeRegion(group, index, options) {
  const segments = group.segments;
  const onset = Math.min(...segments.map((segment) => Number(segment.onset)));
  const end = Math.max(...segments.map((segment) => Number(segment.end)));
  const chroma = weightedChroma(segments);
  const observedPitchClasses = activePitchClasses(chroma, options);
  const bass = aggregateRegionBass(segments, options);
  const candidatesRaw = rankChordCandidates(observedPitchClasses, {
    bassPc: bass.bassPc,
    limit: Math.max(2, Number(options.candidateLimit ?? 5)),
    minSupport: Number(options.minChordSupport ?? 0.16)
  });
  const weights = relativeWeights(candidatesRaw.map((candidate) => candidate.support));
  const candidates = Object.freeze(candidatesRaw.map((candidate, candidateIndex) => Object.freeze({
    ...candidate,
    regionSupport: candidate.support,
    relativeWeight: weights[candidateIndex],
    evidenceClass: "inferred-from-audio",
    bassPc: bass.bassPc,
    bassConfidence: bass.confidence,
    bassEvidence: bass.bassPc == null ? "unavailable-or-ambiguous-low-frequency-audio" : "inferred-low-frequency-audio"
  })));
  const top = candidates[0] || null;
  const constituentMicroSegmentIndices = Object.freeze(segments.map((segment, sourceIndex) =>
    Number.isInteger(segment.index) ? segment.index : sourceIndex
  ));
  return Object.freeze({
    index,
    onset,
    end,
    duration: Math.max(0, end - onset),
    constituentMicroSegmentIndices,
    microSegmentCount: segments.length,
    symbol: top?.symbol ?? null,
    rootPc: top?.rootPc ?? null,
    templateId: top?.templateId ?? null,
    pcs: Object.freeze(top?.pitchClasses ? [...top.pitchClasses] : [...observedPitchClasses]),
    observedPitchClasses,
    chroma,
    candidates,
    ambiguity: candidates.length > 1
      ? clamp01(1 - (candidates[0].relativeWeight - candidates[1].relativeWeight))
      : 0,
    bassPc: bass.bassPc,
    bassConfidence: bass.confidence,
    bassCoverage: bass.coverage,
    bassEvidence: bass.bassPc == null ? "unavailable-or-ambiguous-low-frequency-audio" : "inferred-low-frequency-audio",
    evidenceClass: "inferred-from-audio",
    provenance: Object.freeze({
      rule: segments.length === 1 ? "single-micro-segment" : "conservative-compatible-consolidation",
      mergeReasons: Object.freeze([...group.mergeReasons])
    })
  });
}

export function consolidateHarmonicRegions(segmentsRaw, options = {}) {
  if (!Array.isArray(segmentsRaw)) throw new TypeError("segments must be an array");
  const segments = Object.freeze([...segmentsRaw]);
  if (!segments.length) {
    return Object.freeze({
      regionVersion: HARMONIC_REGION_VERSION,
      evidenceClass: "inferred-from-audio",
      bassEvidence: "inferred-low-frequency-audio-when-confident",
      microSegmentCount: 0,
      regionCount: 0,
      microSegments: segments,
      regions: Object.freeze([])
    });
  }
  for (const segment of segments) {
    if (!segment || !Number.isFinite(Number(segment.onset)) || !Number.isFinite(Number(segment.end))) {
      throw new TypeError("each segment must provide finite onset and end");
    }
    if (Number(segment.end) <= Number(segment.onset)) throw new RangeError("segment end must be greater than onset");
  }

  const groups = absorbAmbiguousBridges(provisionalGroups(segments, options), options);
  const regions = Object.freeze(groups.map((group, index) => makeRegion(group, index, options)));
  return Object.freeze({
    regionVersion: HARMONIC_REGION_VERSION,
    evidenceClass: "inferred-from-audio",
    bassEvidence: "inferred-low-frequency-audio-when-confident",
    microSegmentCount: segments.length,
    regionCount: regions.length,
    microSegments: segments,
    regions,
    note: "Regions conservatively consolidate compatible inferred micro-segments; bass is retained only when segment evidence is coherent. Relative weights are not calibrated probabilities."
  });
}
