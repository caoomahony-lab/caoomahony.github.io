import { mod12 } from "../../theory/pitch.js";

const MOTION_KEYS = Object.freeze(["down5","down4","down3","down2","down1","repeat","up1","up2","up3","up4","up5","tritone"]);

function transitionWeight(next) {
  const value = Number(next?.weight ?? next?.durationSec ?? next?.duration ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function signedRootMotion(fromPc, toPc) {
  let delta = mod12(Number(toPc) - Number(fromPc));
  if (delta > 6) delta -= 12;
  return delta;
}

function keyForDelta(delta) {
  if (delta === 0) return "repeat";
  if (delta === 6) return "tritone";
  return delta < 0 ? `down${Math.abs(delta)}` : `up${delta}`;
}

export function extractRootMotion(rootStates) {
  if (!Array.isArray(rootStates)) throw new TypeError("rootStates must be an array");
  const states = rootStates.filter((state) => state && Number.isFinite(Number(state.rootPc))).map((state) => ({ ...state, rootPc: mod12(state.rootPc) }));
  const counts = Object.fromEntries(MOTION_KEYS.map((key) => [key, 0]));
  const unsigned = Array(7).fill(0);
  let totalWeight = 0;
  let weightedAbs = 0;
  for (let i = 1; i < states.length; i += 1) {
    const delta = signedRootMotion(states[i - 1].rootPc, states[i].rootPc);
    const weight = transitionWeight(states[i]);
    counts[keyForDelta(delta)] += weight;
    unsigned[Math.abs(delta)] += weight;
    totalWeight += weight;
    weightedAbs += Math.abs(delta) * weight;
  }
  const distribution = Object.fromEntries(MOTION_KEYS.map((key) => [key, totalWeight ? counts[key] / totalWeight : 0]));
  return Object.freeze({
    transitionCount: Math.max(0, states.length - 1),
    transitionWeight: totalWeight,
    directedDistribution: Object.freeze(distribution),
    unsignedSemitoneClassDistribution: Object.freeze(unsigned.map((value) => totalWeight ? value / totalWeight : 0)),
    repeatedRootRate: distribution.repeat,
    semitoneStepRate: distribution.down1 + distribution.up1,
    wholeStepRate: distribution.down2 + distribution.up2,
    fourthFifthClassRate: distribution.down5 + distribution.up5,
    tritoneRate: distribution.tritone,
    meanAbsoluteShortestMotion: totalWeight ? weightedAbs / totalWeight : 0,
    evidenceClass: "deterministic"
  });
}
