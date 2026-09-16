import { mod12, pitchClassName } from "./pitch.js";

export const SCALE_TEMPLATES = Object.freeze([
  { name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
  { name: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11] },
  { name: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
  { name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
  { name: "Natural minor", intervals: [0, 2, 3, 5, 7, 8, 10] },
  { name: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10] },
  { name: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10] },
  { name: "Harmonic minor", intervals: [0, 2, 3, 5, 7, 8, 11] }
]);

function softmax(values, temperature = 0.35) {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp((v - max) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((v) => v / sum);
}

export function inferScaleCandidates(activityRaw, limit = 5) {
  const total = activityRaw.reduce((a, b) => a + b, 0);
  if (total <= 1e-9) return [];

  const candidates = [];
  for (let root = 0; root < 12; root += 1) {
    for (const template of SCALE_TEMPLATES) {
      const pcs = template.intervals.map((interval) => mod12(root + interval));
      const member = new Set(pcs);
      let inside = 0;
      let outside = 0;
      for (let pc = 0; pc < 12; pc += 1) {
        if (member.has(pc)) inside += activityRaw[pc] || 0;
        else outside += activityRaw[pc] || 0;
      }
      const rootWeight = activityRaw[root] || 0;
      const fifthWeight = activityRaw[mod12(root + 7)] || 0;
      const score = (inside - 0.72 * outside + 0.18 * rootWeight + 0.06 * fifthWeight) / total;
      candidates.push({
        root,
        rootName: pitchClassName(root),
        scale: template.name,
        label: `${pitchClassName(root)} ${template.name}`,
        pcs,
        score
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, Math.max(limit, 1));
  const confidences = softmax(top.map((c) => c.score));
  return top.map((candidate, i) => ({ ...candidate, confidence: confidences[i] }));
}

export function crystallizationSupport({
  activityNormalized,
  shadowField,
  admittedPcs,
  latentCenter
}) {
  if (latentCenter == null || !shadowField?.length) return null;
  const shadowSet = new Set(shadowField.map(mod12));
  const admitted = new Set((admittedPcs || []).map(mod12));
  const completion = [...shadowSet].filter((pc) => admitted.has(pc)).length / shadowSet.size;
  const shadowActivity = [...shadowSet].reduce((sum, pc) => sum + (activityNormalized[pc] || 0), 0) / shadowSet.size;
  const center = activityNormalized[mod12(latentCenter)] || 0;
  const dominant = activityNormalized[mod12(latentCenter + 7)] || 0;
  const score = Math.min(1, 0.45 * completion + 0.3 * shadowActivity + 0.17 * center + 0.08 * dominant);
  return { score, completion, shadowActivity, centerActivity: center, dominantActivity: dominant };
}
