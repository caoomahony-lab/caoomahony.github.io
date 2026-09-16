import { mod12, pitchClassName } from "./pitch.js";

export function indexEventsByPitchClass(events) {
  const byPc = Array.from({ length: 12 }, () => []);
  for (const event of events || []) {
    if (event.isRest) continue;
    byPc[mod12(event.pitchClass)].push(event);
  }
  return byPc;
}

export function computeAdmissionHistory(events, shadowField, timeSeconds, options = {}) {
  const persistenceWindow = options.persistenceWindow ?? 8;
  const persistentCount = options.persistentCount ?? 2;
  const shadow = new Set(shadowField.map(mod12));
  const seen = new Map();
  const counts = new Map();
  const recentCounts = new Map();

  for (const event of events || []) {
    if (event.onset > timeSeconds) break;
    if (event.isRest || event.tieStop) continue;
    const pc = mod12(event.pitchClass);
    if (!shadow.has(pc)) continue;
    if (!seen.has(pc)) seen.set(pc, event.onset);
    counts.set(pc, (counts.get(pc) || 0) + 1);
    if (event.onset >= timeSeconds - persistenceWindow) {
      recentCounts.set(pc, (recentCounts.get(pc) || 0) + 1);
    }
  }

  const ordered = [...seen.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([pc, firstOnset]) => ({
      pc,
      name: pitchClassName(pc),
      firstOnset,
      count: counts.get(pc) || 0,
      recentCount: recentCounts.get(pc) || 0,
      persistent: (recentCounts.get(pc) || 0) >= persistentCount
    }));

  return {
    ordered,
    admittedPcs: ordered.map((x) => x.pc),
    uniqueCount: ordered.length,
    shadowSize: shadow.size,
    completion: shadow.size ? ordered.length / shadow.size : 0
  };
}

export function compareAdmissionOrder(actualPcs, expectedPcs) {
  const expected = expectedPcs.map(mod12);
  const actual = actualPcs.map(mod12);
  let matchedPrefix = 0;
  while (
    matchedPrefix < actual.length &&
    matchedPrefix < expected.length &&
    actual[matchedPrefix] === expected[matchedPrefix]
  ) {
    matchedPrefix += 1;
  }
  return {
    matchedPrefix,
    exactSoFar: actual.length <= expected.length && matchedPrefix === actual.length,
    complete: actual.length === expected.length && matchedPrefix === expected.length
  };
}
