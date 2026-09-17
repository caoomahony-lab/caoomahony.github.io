function normalizeSet(values, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array`);
  return [...new Set(values.map((value) => ((Number(value) % 12) + 12) % 12))].sort((a, b) => a - b);
}

function jaccard(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  const intersection = [...sa].filter((value) => sb.has(value)).length;
  const union = new Set([...sa, ...sb]).size;
  return union ? intersection / union : 1;
}

export function scoreNoveltyContinuation(candidate, context = {}, options = {}) {
  if (!candidate || !Array.isArray(candidate.pitchClasses)) throw new TypeError("candidate must contain pitchClasses");
  const history = context.recentChords ?? (context.currentChord ? [context.currentChord] : []);
  if (!Array.isArray(history) || !history.length) {
    return Object.freeze({ available: false, score: null, reason: "recent chord history is required", evidenceClass: "deterministic-derived" });
  }
  const candidatePcs = normalizeSet(candidate.pitchClasses, "candidate.pitchClasses");
  const decay = Number(options.recencyDecay ?? 0.72);
  if (!Number.isFinite(decay) || decay <= 0 || decay > 1) throw new RangeError("recencyDecay must be in (0, 1]");

  let weightedSimilarity = 0;
  let totalWeight = 0;
  const comparisons = [];
  const reversed = [...history].reverse();
  for (let index = 0; index < reversed.length; index += 1) {
    const item = reversed[index];
    const pcs = Array.isArray(item) ? item : (item?.pitchClasses ?? item?.pcs);
    if (!Array.isArray(pcs)) throw new TypeError("recentChords entries must be pitch-class arrays or objects containing pitchClasses/pcs");
    const normalized = normalizeSet(pcs, "recentChords pitchClasses");
    const similarity = jaccard(candidatePcs, normalized);
    const weight = decay ** index;
    weightedSimilarity += similarity * weight;
    totalWeight += weight;
    comparisons.push(Object.freeze({ historyOffset: index, similarity, weight }));
  }
  const familiarity = totalWeight > 0 ? weightedSimilarity / totalWeight : 0;
  const score = Math.max(0, Math.min(1, 1 - familiarity));
  return Object.freeze({
    available: true,
    score,
    familiarity,
    recencyDecay: decay,
    comparisons: Object.freeze(comparisons),
    evidenceClass: "deterministic-derived",
    note: "Set-content novelty relative to supplied recent harmonic history; not aesthetic quality."
  });
}
