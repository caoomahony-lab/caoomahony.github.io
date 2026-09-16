import { mod12, pitchClassName } from "../theory/pitch.js";
import { inferScaleCandidatesForCenter } from "./scales.js";

function normalizeHistogram(values, name) {
  if (values == null) return null;
  if ((!Array.isArray(values) && !ArrayBuffer.isView(values)) || values.length !== 12) throw new TypeError(`${name} must contain exactly 12 bins`);
  const array = Array.from(values, (value, index) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) throw new TypeError(`${name}[${index}] must be finite and nonnegative`);
    return numeric;
  });
  const total = array.reduce((a, b) => a + b, 0);
  return total > 0 ? array.map((value) => value / total) : Array(12).fill(0);
}

function softmax(values, temperature = 0.06) {
  if (!values.length) return [];
  const max = Math.max(...values);
  const exp = values.map((value) => Math.exp((value - max) / temperature));
  const sum = exp.reduce((a, b) => a + b, 0) || 1;
  return exp.map((value) => value / sum);
}

export function inferCenterCandidates(activityRaw, { bassActivity = null, limit = 6, scaleLimitPerCenter = 3 } = {}) {
  const activity = normalizeHistogram(activityRaw, "activity");
  if (!activity || activity.every((value) => value === 0)) return Object.freeze([]);
  const bass = normalizeHistogram(bassActivity, "bassActivity");
  const candidates = [];
  for (let centerPc = 0; centerPc < 12; centerPc += 1) {
    const scales = inferScaleCandidatesForCenter(activityRaw, centerPc, { limit: scaleLimitPerCenter });
    const bestScale = scales[0] || null;
    const rootShare = activity[centerPc];
    const fifthShare = activity[mod12(centerPc + 7)];
    const bassRootShare = bass ? bass[centerPc] : 0;
    const support = Math.max(0, Math.min(1, 0.58 * (bestScale?.support || 0) + 0.22 * rootShare + 0.08 * fifthShare + (bass ? 0.12 * bassRootShare : 0)));
    candidates.push({ centerPc, centerName: pitchClassName(centerPc), support, rootShare, fifthShare, bassRootShare: bass ? bassRootShare : null, scaleCandidates: scales });
  }
  candidates.sort((a, b) => b.support - a.support || a.centerPc - b.centerPc);
  const top = candidates.slice(0, Math.max(1, Number(limit) || 1));
  const weights = softmax(top.map((candidate) => candidate.support));
  return Object.freeze(top.map((candidate, index) => Object.freeze({ ...candidate, relativeWeight: weights[index] })));
}
