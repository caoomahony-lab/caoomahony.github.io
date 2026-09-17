function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }

export function continuationCandidateKey(candidate) {
  if (!candidate || typeof candidate !== "object") throw new TypeError("candidate must be an object");
  if (candidate.rootPc != null && candidate.templateId) return `chord:${candidate.rootPc}:${candidate.templateId}`;
  if (!Array.isArray(candidate.pitchClasses)) throw new TypeError("candidate must contain pitchClasses");
  return `set:${[...candidate.pitchClasses].sort((a, b) => a - b).join(".")}`;
}

function lookupEvidence(candidate, evidence, label) {
  if (evidence == null) return null;
  const key = continuationCandidateKey(candidate);
  if (evidence instanceof Map) return evidence.get(key) ?? null;
  if (typeof evidence === "object" && !Array.isArray(evidence)) return evidence[key] ?? null;
  if (Array.isArray(evidence)) {
    return evidence.find((item) => item?.key === key || (item?.rootPc === candidate.rootPc && item?.templateId === candidate.templateId)) ?? null;
  }
  throw new TypeError(`${label} must be a map, object, or array`);
}

export function scoreCorpusContinuation(candidate, context = {}) {
  const record = lookupEvidence(candidate, context.corpusEvidence, "corpusEvidence");
  if (record == null) {
    return Object.freeze({ available: false, score: null, reason: "no corpus evidence for candidate", evidenceClass: "empirical" });
  }
  if (typeof record === "number") {
    return Object.freeze({ available: true, score: clamp01(record), evidenceClass: "empirical", raw: record, note: "Caller-supplied normalized corpus score." });
  }
  const count = Number(record.count ?? 0);
  const total = Number(record.total ?? context.corpusTotal ?? 0);
  const suppliedScore = record.score;
  let score;
  if (suppliedScore != null) score = clamp01(suppliedScore);
  else if (Number.isFinite(count) && count >= 0 && Number.isFinite(total) && total > 0) score = clamp01(count / total);
  else throw new TypeError("corpus evidence requires score or nonnegative count with positive total");
  return Object.freeze({ available: true, score, count: Number.isFinite(count) ? count : null, total: Number.isFinite(total) ? total : null, evidenceClass: "empirical", provenance: record.provenance ?? null, note: "Empirical only to the extent supported by supplied corpus provenance." });
}

export function scoreStyleContinuation(candidate, context = {}) {
  const record = lookupEvidence(candidate, context.styleEvidence, "styleEvidence");
  if (record == null) {
    return Object.freeze({ available: false, score: null, reason: "no style evidence for candidate", evidenceClass: "empirical-or-model" });
  }
  const score = typeof record === "number" ? clamp01(record) : clamp01(record.score);
  if (typeof record !== "number" && !Number.isFinite(Number(record.score))) throw new TypeError("style evidence requires a finite score");
  return Object.freeze({
    available: true,
    score,
    evidenceClass: typeof record === "number" ? "model-input" : (record.evidenceClass ?? "model-input"),
    provenance: typeof record === "number" ? null : (record.provenance ?? null),
    modelId: typeof record === "number" ? null : (record.modelId ?? null),
    note: "Style similarity is supplied evidence, not inferred here without a style model."
  });
}
