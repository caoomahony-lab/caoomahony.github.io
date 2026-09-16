import { mod12 } from "../../theory/pitch.js";

function normalizeCandidates(candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return [];
  const rawWeights = candidates.map((candidate) => {
    const preferred = Number(candidate.relativeWeight);
    if (Number.isFinite(preferred) && preferred >= 0) return preferred;
    const support = Number(candidate.support);
    return Number.isFinite(support) && support >= 0 ? support : 0;
  });
  const total = rawWeights.reduce((a,b) => a+b, 0);
  if (total <= 0) return candidates.map((candidate) => ({ candidate, weight: 1 / candidates.length }));
  return candidates.map((candidate, index) => ({ candidate, weight: rawWeights[index] / total }));
}

function normalizedEntropy(weights) {
  if (weights.length <= 1) return 0;
  let h = 0;
  for (const p of weights) if (p > 0) h -= p * Math.log2(p);
  return h / Math.log2(weights.length);
}

function variance(values, mean) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

function frameWeight(frame) {
  const value = Number(frame?.weight ?? frame?.durationSec ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function extractModalProfile(frames, { referenceCenterPc = null } = {}) {
  if (!Array.isArray(frames)) throw new TypeError("frames must be an array");
  const centerOccupancy = Array(12).fill(0);
  const systemOccupancy = {};
  const ambiguities = [];
  const topCenters = [];
  const pairWeights = {};
  let totalFrameWeight = 0;

  for (const frame of frames) {
    const candidates = normalizeCandidates(frame?.candidates || frame?.scaleCandidates || []);
    if (!candidates.length) continue;
    const weight = frameWeight(frame);
    totalFrameWeight += weight;
    const entropy = normalizedEntropy(candidates.map((entry) => entry.weight));
    ambiguities.push({ value: entropy, weight });
    for (const { candidate, weight: candidateWeight } of candidates) {
      const center = mod12(candidate.centerPc ?? candidate.rootPc ?? candidate.root ?? 0);
      const index = referenceCenterPc == null ? center : mod12(center - referenceCenterPc);
      centerOccupancy[index] += weight * candidateWeight;
      const systemId = candidate.systemId || candidate.scale || candidate.systemName || "unknown";
      systemOccupancy[systemId] = (systemOccupancy[systemId] || 0) + weight * candidateWeight;
    }
    const sorted = [...candidates].sort((a,b) => b.weight - a.weight);
    const top = sorted[0];
    const topCenter = mod12(top.candidate.centerPc ?? top.candidate.rootPc ?? top.candidate.root ?? 0);
    topCenters.push({ center: topCenter, weight });
    if (sorted.length > 1) {
      const second = sorted[1];
      const secondCenter = mod12(second.candidate.centerPc ?? second.candidate.rootPc ?? second.candidate.root ?? 0);
      if (secondCenter !== topCenter) {
        const a = referenceCenterPc == null ? topCenter : mod12(topCenter - referenceCenterPc);
        const b = referenceCenterPc == null ? secondCenter : mod12(secondCenter - referenceCenterPc);
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        pairWeights[key] = (pairWeights[key] || 0) + weight * Math.min(top.weight, second.weight);
      }
    }
  }

  const normalizedCenters = centerOccupancy.map((value) => totalFrameWeight ? value / totalFrameWeight : 0);
  const systemTotal = Object.values(systemOccupancy).reduce((a,b) => a+b, 0);
  const normalizedSystems = Object.fromEntries(Object.entries(systemOccupancy).map(([key,value]) => [key, systemTotal ? value / systemTotal : 0]));
  const ambiguityWeight = ambiguities.reduce((a,b) => a + b.weight, 0);
  const ambiguityMean = ambiguityWeight ? ambiguities.reduce((sum,item) => sum + item.value * item.weight, 0) / ambiguityWeight : 0;
  const simpleMean = ambiguities.length ? ambiguities.reduce((sum,item) => sum + item.value, 0) / ambiguities.length : 0;
  const ambiguityVariance = variance(ambiguities.map((item) => item.value), simpleMean);
  let changes = 0;
  let comparisons = 0;
  for (let i = 1; i < topCenters.length; i += 1) {
    comparisons += 1;
    if (topCenters[i].center !== topCenters[i-1].center) changes += 1;
  }
  const pairTotal = Object.values(pairWeights).reduce((a,b) => a+b,0);
  const dualCenterPairs = Object.freeze(Object.entries(pairWeights)
    .map(([key, value]) => {
      const [a,b] = key.split(":").map(Number);
      return Object.freeze({ a, b, weight: pairTotal ? value / pairTotal : 0 });
    })
    .sort((x,y) => y.weight - x.weight || x.a - y.a || x.b - y.b));
  return Object.freeze({
    coordinateMode: referenceCenterPc == null ? "absolute" : "relative-to-reference-center",
    referenceCenterPc: referenceCenterPc == null ? null : mod12(referenceCenterPc),
    centerOccupancy: Object.freeze(normalizedCenters),
    systemOccupancy: Object.freeze(normalizedSystems),
    ambiguityMean,
    ambiguityVariance,
    centerChangeRate: comparisons ? changes / comparisons : 0,
    dualCenterPairs,
    frameCount: frames.length,
    evidenceClass: "inferred-summary"
  });
}
