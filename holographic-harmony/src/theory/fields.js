import { mod12, sortPitchClasses, pitchClassName } from "./pitch.js";

export const Z12 = Object.freeze([...Array(12).keys()]);

export function normalizeField(pcs) {
  return sortPitchClasses(pcs);
}

export function complementField(activeField) {
  const active = new Set(normalizeField(activeField));
  return Z12.filter((pc) => !active.has(pc));
}

export function validatePartition(activeField, shadowField = complementField(activeField)) {
  const active = new Set(normalizeField(activeField));
  const shadow = new Set(normalizeField(shadowField));
  const intersection = [...active].filter((pc) => shadow.has(pc));
  const union = new Set([...active, ...shadow]);
  return {
    valid: intersection.length === 0 && union.size === 12 && active.size + shadow.size === 12,
    intersection,
    unionSize: union.size,
    activeSize: active.size,
    shadowSize: shadow.size
  };
}

export function reciprocalSubstitution(activeField, removePc, addPc) {
  const p = mod12(removePc);
  const q = mod12(addPc);
  const active = new Set(normalizeField(activeField));
  const shadow = new Set(complementField(activeField));

  if (!active.has(p)) throw new Error(`${pitchClassName(p)} is not in the active field`);
  if (!shadow.has(q)) throw new Error(`${pitchClassName(q)} is not in the shadow field`);

  active.delete(p);
  active.add(q);
  return {
    active: normalizeField([...active]),
    shadow: complementField([...active]),
    removedFromActive: p,
    admittedToActive: q
  };
}

export function fieldLabel(pcs, preferFlats = false) {
  return normalizeField(pcs).map((pc) => pitchClassName(pc, preferFlats)).join(" ");
}
