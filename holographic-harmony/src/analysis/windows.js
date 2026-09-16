const MODES = new Set(["seconds", "beats", "measures"]);
const WEIGHTINGS = new Set(["uniform", "duration", "decay"]);

export const DEFAULT_ANALYSIS_WINDOW_SPECS = Object.freeze({
  local: Object.freeze({ id: "local", mode: "beats", size: 2, hop: 1, weighting: "duration" }),
  phrase: Object.freeze({ id: "phrase", mode: "measures", size: 4, hop: 1, weighting: "duration" }),
  field: Object.freeze({ id: "field", mode: "measures", size: 12, hop: 2, weighting: "decay" })
});

export function validateAnalysisWindowSpec(spec) {
  if (!spec || typeof spec !== "object") throw new TypeError("window spec must be an object");
  const id = String(spec.id || "").trim();
  if (!id) throw new TypeError("window spec id must be non-empty");
  if (!MODES.has(spec.mode)) throw new RangeError(`Unsupported window mode: ${spec.mode}`);
  const size = Number(spec.size);
  const hop = Number(spec.hop);
  if (!Number.isFinite(size) || size <= 0) throw new RangeError("window size must be > 0");
  if (!Number.isFinite(hop) || hop <= 0) throw new RangeError("window hop must be > 0");
  if (!WEIGHTINGS.has(spec.weighting)) throw new RangeError(`Unsupported window weighting: ${spec.weighting}`);
  const decayTau = spec.decayTau == null ? size / 2 : Number(spec.decayTau);
  if (!Number.isFinite(decayTau) || decayTau <= 0) throw new RangeError("decayTau must be > 0");
  return Object.freeze({ id, mode: spec.mode, size, hop, weighting: spec.weighting, decayTau });
}

function eventRange(event, mode) {
  if (mode === "seconds") {
    if (!Number.isFinite(event.onsetSec) || !Number.isFinite(event.endSec)) {
      throw new TypeError("seconds windows require onsetSec and endSec");
    }
    return [event.onsetSec, event.endSec];
  }
  if (mode === "beats") {
    if (!Number.isFinite(event.scoreOnsetQuarterBeat)) {
      throw new TypeError("beat windows require scoreOnsetQuarterBeat");
    }
    const duration = Number.isFinite(event.scoreDurationQuarterBeats) ? event.scoreDurationQuarterBeats : 0;
    return [event.scoreOnsetQuarterBeat, event.scoreOnsetQuarterBeat + Math.max(0, duration)];
  }
  if (!Number.isInteger(event.measure) || event.measure < 1) {
    throw new TypeError("measure windows require a positive integer measure");
  }
  const start = event.measure - 1;
  return [start, start + 1];
}

function extentForEvents(events, mode) {
  let extent = 0;
  for (const event of events) {
    const [, end] = eventRange(event, mode);
    extent = Math.max(extent, end);
  }
  return extent;
}

function overlaps(start, end, eventStart, eventEnd) {
  if (eventEnd === eventStart) return eventStart >= start && eventStart < end;
  return eventStart < end && eventEnd > start;
}

function eventWeight(spec, start, end, eventStart, eventEnd) {
  if (spec.weighting === "uniform") return 1;
  if (spec.weighting === "duration") {
    if (eventEnd === eventStart) return 1;
    return Math.max(0, Math.min(end, eventEnd) - Math.max(start, eventStart));
  }
  const midpoint = eventEnd === eventStart ? eventStart : (Math.max(start, eventStart) + Math.min(end, eventEnd)) / 2;
  return Math.exp(-Math.max(0, end - midpoint) / spec.decayTau);
}

export function createAnalysisWindows(events, rawSpec) {
  if (!Array.isArray(events)) throw new TypeError("events must be an array");
  const spec = validateAnalysisWindowSpec(rawSpec);
  if (!events.length) return Object.freeze([]);
  const extent = extentForEvents(events, spec.mode);
  const windows = [];

  for (let start = 0, index = 0; start < extent; start += spec.hop, index += 1) {
    const end = start + spec.size;
    const members = [];
    const weights = [];
    const eventIndices = [];

    events.forEach((event, eventIndex) => {
      const [eventStart, eventEnd] = eventRange(event, spec.mode);
      if (!overlaps(start, end, eventStart, eventEnd)) return;
      members.push(event);
      weights.push(eventWeight(spec, start, end, eventStart, eventEnd));
      eventIndices.push(eventIndex);
    });

    windows.push(Object.freeze({
      id: `${spec.id}:${index}`,
      specId: spec.id,
      index,
      mode: spec.mode,
      start,
      end,
      center: (start + end) / 2,
      weighting: spec.weighting,
      eventIndices: Object.freeze(eventIndices),
      events: Object.freeze(members),
      weights: Object.freeze(weights)
    }));
  }

  return Object.freeze(windows);
}

export function createGlobalWindow(events, { id = "global", weighting = "duration", mode = "seconds" } = {}) {
  if (!Array.isArray(events)) throw new TypeError("events must be an array");
  if (!events.length) return Object.freeze({
    id,
    specId: id,
    index: 0,
    mode,
    start: 0,
    end: 0,
    center: 0,
    weighting,
    eventIndices: Object.freeze([]),
    events: Object.freeze([]),
    weights: Object.freeze([])
  });
  const extent = extentForEvents(events, mode);
  const safeSize = Math.max(extent, Number.EPSILON);
  return createAnalysisWindows(events, { id, mode, size: safeSize, hop: safeSize, weighting })[0];
}
