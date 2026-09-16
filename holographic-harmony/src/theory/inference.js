import { mod12 } from "./pitch.js";
import { SCALE_SYSTEMS, inferScaleCandidates as inferScaleCandidatesV2 } from "../inference/scales.js";

export const SCALE_TEMPLATES = Object.freeze(SCALE_SYSTEMS.map((system) => Object.freeze({
  name: system.name,
  intervals: system.intervals
})));

// Compatibility facade for the v0.1 visualizer. New code should consume
// src/inference/scales.js and use support/relativeWeight terminology.
export function inferScaleCandidates(activityRaw, limit = 5) {
  return inferScaleCandidatesV2(activityRaw, { limit }).map((candidate) => ({
    root: candidate.rootPc,
    rootName: candidate.rootName,
    scale: candidate.scale,
    label: candidate.label,
    pcs: candidate.pcs,
    score: candidate.support,
    support: candidate.support,
    confidence: candidate.relativeWeight,
    relativeWeight: candidate.relativeWeight
  }));
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
