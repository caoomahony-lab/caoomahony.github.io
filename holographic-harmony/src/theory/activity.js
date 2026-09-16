import { mod12 } from "./pitch.js";

export const DEFAULT_ACTIVITY_CONFIG = Object.freeze({
  lookbackSeconds: 12,
  attackTau: 2.4,
  releaseTau: 5.2,
  attackWeight: 1.0,
  holdWeight: 1.25,
  durationWeight: 0.28,
  durationCapSeconds: 3.0
});

function upperBoundOnset(events, t) {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].onset <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function computePitchClassActivity(events, timeSeconds, config = {}) {
  const cfg = { ...DEFAULT_ACTIVITY_CONFIG, ...config };
  const values = Array(12).fill(0);
  if (!events?.length || timeSeconds < 0) return { raw: values, normalized: values };

  const endIndex = upperBoundOnset(events, timeSeconds);
  const lowerBound = timeSeconds - cfg.lookbackSeconds;

  for (let i = endIndex - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.onset < lowerBound) break;
    if (event.isRest) continue;

    const pc = mod12(event.pitchClass);
    const age = Math.max(0, timeSeconds - event.onset);
    const end = event.onset + Math.max(0, event.duration || 0);
    const currentlySounding = timeSeconds <= end;
    const afterEnd = Math.max(0, timeSeconds - end);
    const attack = cfg.attackWeight * Math.exp(-age / cfg.attackTau);
    const hold = currentlySounding
      ? cfg.holdWeight
      : cfg.holdWeight * Math.exp(-afterEnd / cfg.releaseTau);
    const duration = cfg.durationWeight * Math.min(cfg.durationCapSeconds, Math.max(0, event.duration || 0));
    const continuationFactor = event.tieStop && !event.tieStart ? 0.35 : 1;

    values[pc] += continuationFactor * (attack + hold + duration);
  }

  const max = Math.max(...values, 1e-9);
  return {
    raw: values,
    normalized: values.map((v) => Math.min(1, v / max))
  };
}

export function recentFlashStrength(events, timeSeconds, pc, flashSeconds = 0.7) {
  const target = mod12(pc);
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.onset > timeSeconds) continue;
    const age = timeSeconds - event.onset;
    if (age > flashSeconds) break;
    if (!event.isRest && mod12(event.pitchClass) === target && !event.tieStop) {
      return 1 - age / flashSeconds;
    }
  }
  return 0;
}
