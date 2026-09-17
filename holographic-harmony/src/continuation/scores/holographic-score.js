function mod12(value) { return ((Number(value) % 12) + 12) % 12; }

function normalizedSet(values, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array`);
  return [...new Set(values.map(mod12))].sort((a, b) => a - b);
}

export function scoreHolographicContinuation(candidate, context = {}, options = {}) {
  if (!candidate || !Array.isArray(candidate.pitchClasses)) throw new TypeError("candidate must contain pitchClasses");
  if (!Array.isArray(context.activeField) || !Array.isArray(context.shadowField)) {
    return Object.freeze({ available: false, score: null, reason: "activeField and shadowField are required", evidenceClass: "model-derived" });
  }
  const active = new Set(normalizedSet(context.activeField, "activeField"));
  const shadow = new Set(normalizedSet(context.shadowField, "shadowField"));
  if ([...active].some((pc) => shadow.has(pc))) throw new RangeError("activeField and shadowField must be disjoint");
  const pcs = normalizedSet(candidate.pitchClasses, "candidate.pitchClasses");
  const activePcs = pcs.filter((pc) => active.has(pc));
  const shadowPcs = pcs.filter((pc) => shadow.has(pc));
  const outsidePcs = pcs.filter((pc) => !active.has(pc) && !shadow.has(pc));
  const activeShare = pcs.length ? activePcs.length / pcs.length : 0;
  const shadowShare = pcs.length ? shadowPcs.length / pcs.length : 0;
  const outsideShare = pcs.length ? outsidePcs.length / pcs.length : 0;
  const admissionTarget = Number(options.admissionTarget ?? 1);
  if (!Number.isFinite(admissionTarget) || admissionTarget < 0) throw new RangeError("admissionTarget must be nonnegative");
  const admissionCloseness = admissionTarget === 0
    ? (shadowPcs.length === 0 ? 1 : 0)
    : Math.max(0, 1 - Math.abs(shadowPcs.length - admissionTarget) / Math.max(1, admissionTarget + 1));
  const activeWeight = Number(options.activeRetentionWeight ?? 0.75);
  const admissionWeight = Number(options.admissionWeight ?? 0.25);
  if (!Number.isFinite(activeWeight) || activeWeight < 0 || !Number.isFinite(admissionWeight) || admissionWeight < 0 || activeWeight + admissionWeight <= 0) {
    throw new RangeError("Holographic score weights must be finite, nonnegative, and sum positive");
  }
  const score = Math.max(0, Math.min(1, (activeWeight * activeShare + admissionWeight * admissionCloseness) / (activeWeight + admissionWeight)));
  return Object.freeze({
    available: true,
    score,
    activePitchClasses: Object.freeze(activePcs),
    shadowPitchClasses: Object.freeze(shadowPcs),
    outsidePartitionPitchClasses: Object.freeze(outsidePcs),
    activeShare,
    shadowShare,
    outsideShare,
    admissionCount: shadowPcs.length,
    admissionTarget,
    admissionCloseness,
    evidenceClass: "model-derived",
    note: "Holographic continuity heuristic rewards active-field retention and configurable shadow-admission behavior; it is not a perceptual probability."
  });
}
