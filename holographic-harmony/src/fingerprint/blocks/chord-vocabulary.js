import { describeSetClass } from "../../theory/set-class.js";
import { rankChordCandidates } from "../../theory/chords.js";

function normalizeSonority(sonority) {
  if (Array.isArray(sonority)) return { pcs: sonority, bassPc: null, weight: 1 };
  if (!sonority || !Array.isArray(sonority.pcs)) throw new TypeError("sonorities must be pitch-class arrays or {pcs,bassPc,weight}");
  const weight = Number(sonority.weight ?? sonority.durationSec ?? 1);
  return { pcs: sonority.pcs, bassPc: sonority.bassPc ?? null, weight: Number.isFinite(weight) && weight > 0 ? weight : 1 };
}

function entropy(distribution) {
  let value = 0;
  for (const p of Object.values(distribution)) if (p > 0) value -= p * Math.log2(p);
  return value;
}

function normalizeCounts(counts, total) {
  return Object.fromEntries(Object.entries(counts).map(([key,value]) => [key, total ? value / total : 0]));
}

export function extractChordVocabulary(sonorities, { chordCandidateLimit = 5, minimumChordSupport = 0.55 } = {}) {
  if (!Array.isArray(sonorities)) throw new TypeError("sonorities must be an array");
  const normalized = sonorities.map(normalizeSonority);
  const setClassCounts = {};
  const cardinalityCounts = {};
  const chordTemplateCounts = {};
  const chordExamples = [];
  let totalWeight = 0;
  let labeledWeight = 0;

  for (const sonority of normalized) {
    const descriptor = describeSetClass(sonority.pcs);
    const setKey = descriptor.inversionClassKey;
    setClassCounts[setKey] = (setClassCounts[setKey] || 0) + sonority.weight;
    cardinalityCounts[descriptor.cardinality] = (cardinalityCounts[descriptor.cardinality] || 0) + sonority.weight;
    totalWeight += sonority.weight;
    const candidates = rankChordCandidates(sonority.pcs, { bassPc: sonority.bassPc, limit: chordCandidateLimit, minSupport: minimumChordSupport });
    const best = candidates[0] || null;
    if (best && best.support >= minimumChordSupport) {
      chordTemplateCounts[best.templateId] = (chordTemplateCounts[best.templateId] || 0) + sonority.weight;
      labeledWeight += sonority.weight;
      chordExamples.push(Object.freeze({ pitchClasses: descriptor.pitchClasses, setClassKey: setKey, templateId: best.templateId, rootPc: best.rootPc, symbol: best.symbol, support: best.support, weight: sonority.weight }));
    }
  }

  const setClassDistribution = normalizeCounts(setClassCounts, totalWeight);
  const cardinalityDistribution = normalizeCounts(cardinalityCounts, totalWeight);
  const chordTemplateDistribution = normalizeCounts(chordTemplateCounts, labeledWeight);
  return Object.freeze({
    sonorityCount: normalized.length,
    totalWeight,
    setClassDistribution: Object.freeze(setClassDistribution),
    cardinalityDistribution: Object.freeze(cardinalityDistribution),
    chordTemplateDistribution: Object.freeze(chordTemplateDistribution),
    setClassEntropyBits: entropy(setClassDistribution),
    chordTemplateEntropyBits: entropy(chordTemplateDistribution),
    labeledWeightShare: totalWeight ? labeledWeight / totalWeight : 0,
    chordExamples: Object.freeze(chordExamples),
    evidenceClass: Object.freeze({ setClasses: "deterministic", chordTemplates: "inferred" })
  });
}
