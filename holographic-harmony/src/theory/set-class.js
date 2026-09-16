import { mod12, sortPitchClasses } from "./pitch.js";

function assertIterable(pcs) {
  if (!pcs || typeof pcs[Symbol.iterator] !== "function") throw new TypeError("pitch-class set must be iterable");
}

function freezeArray(values) {
  return Object.freeze([...values]);
}

export function normalizePitchClassSet(pcs) {
  assertIterable(pcs);
  return freezeArray(sortPitchClasses(Array.from(pcs, (pc) => {
    const value = Number(pc);
    if (!Number.isFinite(value)) throw new TypeError("pitch classes must be finite numbers");
    return mod12(value);
  })));
}

function rotationsUnwrapped(sorted) {
  const n = sorted.length;
  const result = [];
  for (let start = 0; start < n; start += 1) {
    const rotation = [];
    for (let offset = 0; offset < n; offset += 1) {
      const index = (start + offset) % n;
      let value = sorted[index];
      if (index < start) value += 12;
      rotation.push(value);
    }
    result.push(rotation);
  }
  return result;
}

function packedLeftCompare(a, b) {
  const spanA = a.length > 1 ? a[a.length - 1] - a[0] : 0;
  const spanB = b.length > 1 ? b[b.length - 1] - b[0] : 0;
  if (spanA !== spanB) return spanA - spanB;
  for (let i = a.length - 2; i >= 1; i -= 1) {
    const da = a[i] - a[0];
    const db = b[i] - b[0];
    if (da !== db) return da - db;
  }
  return mod12(a[0]) - mod12(b[0]);
}

export function normalOrder(pcs) {
  const set = normalizePitchClassSet(pcs);
  if (set.length <= 1) return set;
  const candidates = rotationsUnwrapped(set).sort(packedLeftCompare);
  return freezeArray(candidates[0].map(mod12));
}

export function transposeSet(pcs, semitones) {
  const shift = Number(semitones);
  if (!Number.isInteger(shift)) throw new TypeError("semitones must be an integer");
  return normalizePitchClassSet(Array.from(pcs, (pc) => mod12(Number(pc) + shift)));
}

export function invertSet(pcs, axis = 0) {
  const a = Number(axis);
  if (!Number.isInteger(a)) throw new TypeError("axis must be an integer pitch class");
  return normalizePitchClassSet(Array.from(pcs, (pc) => mod12(a - Number(pc))));
}

function zeroNormalOrder(pcs) {
  const order = normalOrder(pcs);
  if (!order.length) return order;
  return freezeArray(order.map((pc) => mod12(pc - order[0])));
}

function primeCompare(a, b) {
  if (a.length !== b.length) return a.length - b.length;
  if (a.length <= 1) return 0;
  for (let i = a.length - 1; i >= 1; i -= 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

export function primeForm(pcs) {
  const original = zeroNormalOrder(pcs);
  if (original.length <= 1) return original;
  const inverted = zeroNormalOrder(invertSet(pcs, 0));
  return freezeArray(primeCompare(original, inverted) <= 0 ? original : inverted);
}

export function intervalClassVector(pcs) {
  const set = normalizePitchClassSet(pcs);
  const counts = Array(6).fill(0);
  for (let i = 0; i < set.length; i += 1) {
    for (let j = i + 1; j < set.length; j += 1) {
      const d = mod12(set[j] - set[i]);
      const ic = Math.min(d, 12 - d);
      if (ic >= 1 && ic <= 6) counts[ic - 1] += 1;
    }
  }
  return freezeArray(counts);
}

export function complementPitchClassSet(pcs) {
  const set = new Set(normalizePitchClassSet(pcs));
  return freezeArray([...Array(12).keys()].filter((pc) => !set.has(pc)));
}

export function transpositionClassKey(pcs) {
  const set = normalizePitchClassSet(pcs);
  if (!set.length) return "[]";
  let best = null;
  for (const origin of set) {
    const normalized = transposeSet(set, -origin);
    const key = normalized.join(",");
    if (best == null || key < best) best = key;
  }
  return `[${best}]`;
}

export function inversionClassKey(pcs) {
  const direct = transpositionClassKey(pcs);
  const inverted = transpositionClassKey(invertSet(pcs, 0));
  return direct < inverted ? direct : inverted;
}

export function describeSetClass(pcs) {
  const normalized = normalizePitchClassSet(pcs);
  return Object.freeze({
    pitchClasses: normalized,
    cardinality: normalized.length,
    normalOrder: normalOrder(normalized),
    primeForm: primeForm(normalized),
    intervalClassVector: intervalClassVector(normalized),
    complement: complementPitchClassSet(normalized),
    transpositionClassKey: transpositionClassKey(normalized),
    inversionClassKey: inversionClassKey(normalized)
  });
}

export function areTranspositionallyEquivalent(a, b) {
  return transpositionClassKey(a) === transpositionClassKey(b);
}

export function areInversionallyEquivalent(a, b) {
  return inversionClassKey(a) === inversionClassKey(b);
}
