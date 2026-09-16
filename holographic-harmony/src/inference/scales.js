import { mod12, pitchClassName } from "../theory/pitch.js";

export const SCALE_SYSTEMS = Object.freeze([
  { id: "major", name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11], characteristic: [] },
  { id: "lydian", name: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11], characteristic: [6] },
  { id: "mixolydian", name: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10], characteristic: [10] },
  { id: "dorian", name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10], characteristic: [9] },
  { id: "natural-minor", name: "Natural minor", intervals: [0, 2, 3, 5, 7, 8, 10], characteristic: [8] },
  { id: "phrygian", name: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10], characteristic: [1] },
  { id: "locrian", name: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10], characteristic: [1, 6] },
  { id: "harmonic-minor", name: "Harmonic minor", intervals: [0, 2, 3, 5, 7, 8, 11], characteristic: [11] }
].map((system) => Object.freeze({ ...system, intervals: Object.freeze([...system.intervals]), characteristic: Object.freeze([...system.characteristic]) })));

export const SCALE_TEMPLATES = SCALE_SYSTEMS;

function normalizeActivity(activityRaw) {
  if ((!Array.isArray(activityRaw) && !ArrayBuffer.isView(activityRaw)) || activityRaw.length !== 12) throw new TypeError("activity must contain exactly 12 bins");
  const values = Array.from(activityRaw, (value, index) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) throw new TypeError(`activity[${index}] must be a finite nonnegative number`);
    return numeric;
  });
  const total = values.reduce((sum, value) => sum + value, 0);
  return { values, total, normalized: total > 0 ? values.map((value) => value / total) : Array(12).fill(0) };
}

function softmax(values, temperature = 0.08) {
  if (!values.length) return [];
  const max = Math.max(...values);
  const exps = values.map((value) => Math.exp((value - max) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((value) => value / sum);
}

function clamp01(value) { return Math.max(0, Math.min(1, value)); }

export function scoreScaleSystem(activityRaw, rootPc, system) {
  const { total, normalized } = normalizeActivity(activityRaw);
  if (total <= 0) return Object.freeze({ support: 0, insideShare: 0, outsideShare: 0, rootShare: 0, fifthShare: 0, characteristicShare: 0 });
  const root = mod12(rootPc);
  const member = new Set(system.intervals.map((interval) => mod12(root + interval)));
  const insideShare = [...member].reduce((sum, pc) => sum + normalized[pc], 0);
  const outsideShare = 1 - insideShare;
  const rootShare = normalized[root];
  const fifthShare = normalized[mod12(root + 7)];
  const characteristicPcs = system.characteristic.map((interval) => mod12(root + interval));
  const characteristicShare = characteristicPcs.length ? characteristicPcs.reduce((sum, pc) => sum + normalized[pc], 0) / characteristicPcs.length : 0;
  const support = clamp01(0.74 * insideShare + 0.14 * rootShare + 0.06 * fifthShare + 0.06 * characteristicShare - 0.20 * outsideShare);
  return Object.freeze({ support, insideShare, outsideShare, rootShare, fifthShare, characteristicShare });
}

export function inferScaleCandidates(activityRaw, { limit = 8, roots = null, systems = SCALE_SYSTEMS } = {}) {
  const { total } = normalizeActivity(activityRaw);
  if (total <= 0) return Object.freeze([]);
  const rootsToTry = roots == null ? [...Array(12).keys()] : [...new Set(Array.from(roots, mod12))];
  const candidates = [];
  for (const rootPc of rootsToTry) {
    for (const system of systems) {
      const metrics = scoreScaleSystem(activityRaw, rootPc, system);
      const pcs = Object.freeze(system.intervals.map((interval) => mod12(rootPc + interval)).sort((a, b) => a - b));
      candidates.push({ rootPc, rootName: pitchClassName(rootPc), systemId: system.id, scale: system.name, label: `${pitchClassName(rootPc)} ${system.name}`, pcs, ...metrics });
    }
  }
  candidates.sort((a, b) => b.support - a.support || b.insideShare - a.insideShare || a.rootPc - b.rootPc || a.systemId.localeCompare(b.systemId));
  const top = candidates.slice(0, Math.max(1, Number(limit) || 1));
  const weights = softmax(top.map((candidate) => candidate.support));
  return Object.freeze(top.map((candidate, index) => Object.freeze({ ...candidate, relativeWeight: weights[index] })));
}

export function inferScaleCandidatesForCenter(activityRaw, centerPc, options = {}) {
  return inferScaleCandidates(activityRaw, { ...options, roots: [mod12(centerPc)] });
}
