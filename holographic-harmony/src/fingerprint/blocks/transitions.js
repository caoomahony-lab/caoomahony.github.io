function stateKey(state) {
  if (typeof state === "string") return state;
  if (!state || typeof state !== "object") throw new TypeError("transition states must be strings or objects");
  if (state.roman) return state.roman;
  if (state.functionKey) return state.functionKey;
  if (state.degreeLabel && state.templateId) return `${state.degreeLabel}:${state.templateId}`;
  if (state.setClassKey) return `set:${state.setClassKey}`;
  if (Number.isFinite(Number(state.rootPc)) && state.templateId) return `root${Number(state.rootPc)}:${state.templateId}`;
  throw new TypeError("state lacks a usable transition identity");
}

function stateWeight(state) {
  if (typeof state !== "object" || state == null) return 1;
  const value = Number(state.weight ?? state.durationSec ?? state.duration ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function compress(states) {
  const out = [];
  for (const state of states) {
    const key = stateKey(state);
    const weight = stateWeight(state);
    if (out.length && out[out.length - 1].key === key) out[out.length - 1].weight += weight;
    else out.push({ key, weight });
  }
  return out;
}

function entropy(probabilities) {
  let value = 0;
  for (const p of probabilities) if (p > 0) value -= p * Math.log2(p);
  return value;
}

export function extractChordTransitions(states, { compressRepeats = true, maxNGram = 5 } = {}) {
  if (!Array.isArray(states)) throw new TypeError("states must be an array");
  const normalized = states.map((state) => ({ key: stateKey(state), weight: stateWeight(state) }));
  const sequence = compressRepeats ? compress(states) : normalized;
  const transitionCounts = {};
  const outgoing = {};
  let totalTransitions = 0;
  for (let i = 1; i < sequence.length; i += 1) {
    const from = sequence[i - 1].key;
    const to = sequence[i].key;
    const weight = sequence[i].weight;
    const key = `${from}→${to}`;
    transitionCounts[key] = (transitionCounts[key] || 0) + weight;
    outgoing[from] ||= {};
    outgoing[from][to] = (outgoing[from][to] || 0) + weight;
    totalTransitions += weight;
  }
  const transitionProbabilities = {};
  let weightedConditionalEntropy = 0;
  let outgoingWeightTotal = 0;
  for (const [from, targets] of Object.entries(outgoing)) {
    const total = Object.values(targets).reduce((a,b) => a+b, 0);
    transitionProbabilities[from] = Object.fromEntries(Object.entries(targets).map(([to,count]) => [to, count / total]));
    weightedConditionalEntropy += entropy(Object.values(transitionProbabilities[from])) * total;
    outgoingWeightTotal += total;
  }
  const ngrams = {};
  const maxN = Math.max(2, Math.min(5, Number(maxNGram) || 5));
  for (let n = 2; n <= maxN; n += 1) {
    const bucket = {};
    for (let i = 0; i + n <= sequence.length; i += 1) {
      const key = sequence.slice(i, i+n).map((state) => state.key).join("→");
      bucket[key] = (bucket[key] || 0) + 1;
    }
    ngrams[n] = Object.freeze(bucket);
  }
  const durations = sequence.map((state) => state.weight);
  const meanStateWeight = durations.length ? durations.reduce((a,b) => a+b,0) / durations.length : 0;
  return Object.freeze({
    originalStateCount: states.length,
    stateCount: sequence.length,
    compressedRepeats: compressRepeats,
    sequence: Object.freeze(sequence.map((state) => state.key)),
    transitionCounts: Object.freeze(transitionCounts),
    transitionProbabilities: Object.freeze(Object.fromEntries(Object.entries(transitionProbabilities).map(([from, targets]) => [from, Object.freeze(targets)]))),
    conditionalEntropyBits: outgoingWeightTotal ? weightedConditionalEntropy / outgoingWeightTotal : 0,
    ngrams: Object.freeze(ngrams),
    meanStateWeight,
    transitionWeight: totalTransitions,
    evidenceClass: "deterministic-under-state-labels"
  });
}
