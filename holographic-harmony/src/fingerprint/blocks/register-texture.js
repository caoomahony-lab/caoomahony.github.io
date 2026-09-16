function validateEvents(events) {
  events.forEach((event, index) => {
    if (!Number.isFinite(event.onsetSec) || !Number.isFinite(event.endSec) || event.endSec < event.onsetSec) {
      throw new TypeError(`events[${index}] must have valid onsetSec/endSec`);
    }
    if (!Number.isInteger(event.midi) || event.midi < 0 || event.midi > 127) {
      throw new TypeError(`events[${index}].midi must be an integer in 0..127`);
    }
  });
}

function weightedMedian(pairs) {
  if (!pairs.length) return null;
  const sorted = [...pairs].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, pair) => sum + pair.weight, 0);
  if (!(total > 0)) return sorted[Math.floor(sorted.length / 2)].value;
  let cumulative = 0;
  for (const pair of sorted) {
    cumulative += pair.weight;
    if (cumulative >= total / 2) return pair.value;
  }
  return sorted.at(-1).value;
}

function buildTextureTimeline(events) {
  const positive = events.filter((event) => event.endSec > event.onsetSec);
  const boundaries = [...new Set(positive.flatMap((event) => [event.onsetSec, event.endSec]))].sort((a, b) => a - b);
  const segments = [];
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    if (!(end > start)) continue;
    const mid = (start + end) / 2;
    const active = positive.filter((event) => event.onsetSec <= mid && event.endSec > mid);
    if (!active.length) continue;
    const midis = [...new Set(active.map((event) => event.midi))].sort((a, b) => a - b);
    segments.push({
      start,
      end,
      mid,
      duration: end - start,
      bassMidi: midis[0],
      topMidi: midis.at(-1),
      span: midis.at(-1) - midis[0],
      cardinality: midis.length
    });
  }
  return segments;
}

function weightedMean(segments, selector, totalDuration) {
  if (!(totalDuration > 0)) return 0;
  return segments.reduce((sum, segment) => sum + selector(segment) * segment.duration, 0) / totalDuration;
}

function weightedSlope(segments, selector, start, end) {
  if (segments.length < 2 || !(end > start)) return 0;
  const rows = segments.map((segment) => ({
    x: (segment.mid - start) / (end - start),
    y: selector(segment),
    w: segment.duration
  }));
  const totalWeight = rows.reduce((sum, row) => sum + row.w, 0);
  if (!(totalWeight > 0)) return 0;
  const mx = rows.reduce((sum, row) => sum + row.x * row.w, 0) / totalWeight;
  const my = rows.reduce((sum, row) => sum + row.y * row.w, 0) / totalWeight;
  const numerator = rows.reduce((sum, row) => sum + row.w * (row.x - mx) * (row.y - my), 0);
  const denominator = rows.reduce((sum, row) => sum + row.w * ((row.x - mx) ** 2), 0);
  return denominator > 0 ? numerator / denominator : 0;
}

export function extractRegisterTexture(events) {
  if (!Array.isArray(events)) throw new TypeError("events must be an array");
  validateEvents(events);
  if (!events.length) {
    return Object.freeze({
      totalPitchSpan: 0,
      minMidi: null,
      maxMidi: null,
      medianMidi: null,
      durationWeightedMedianMidi: null,
      meanBassMidi: null,
      meanTopMidi: null,
      meanBassTopSeparation: 0,
      simultaneityCardinality: Object.freeze({}),
      meanSimultaneity: 0,
      attackDensityPerSecond: 0,
      spanSlopeSemitonesPerNormalizedTime: 0,
      expansionTransitionRate: 0,
      contractionTransitionRate: 0,
      sparseTextureShare: 0,
      denseTextureShare: 0,
      registralClimaxPosition: null,
      bassTopIndependenceRate: 0,
      soundingDurationSec: 0,
      segmentCount: 0
    });
  }

  const minMidi = Math.min(...events.map((event) => event.midi));
  const maxMidi = Math.max(...events.map((event) => event.midi));
  const medianMidi = [...events.map((event) => event.midi)].sort((a, b) => a - b)[Math.floor((events.length - 1) / 2)];
  const durationWeightedMedianMidi = weightedMedian(events.map((event) => ({ value: event.midi, weight: Math.max(0, event.endSec - event.onsetSec) })));
  const start = Math.min(...events.map((event) => event.onsetSec));
  const end = Math.max(...events.map((event) => event.endSec));
  const pieceDuration = Math.max(0, end - start);
  const segments = buildTextureTimeline(events);
  const soundingDurationSec = segments.reduce((sum, segment) => sum + segment.duration, 0);
  const cardinalityDurations = new Map();
  for (const segment of segments) {
    cardinalityDurations.set(segment.cardinality, (cardinalityDurations.get(segment.cardinality) || 0) + segment.duration);
  }
  const simultaneityCardinality = Object.freeze(Object.fromEntries(
    [...cardinalityDurations.entries()].sort((a, b) => a[0] - b[0]).map(([cardinality, duration]) => [String(cardinality), soundingDurationSec > 0 ? duration / soundingDurationSec : 0])
  ));

  let expansion = 0;
  let contraction = 0;
  let motionTransitions = 0;
  let independentMoves = 0;
  let anyBassTopMoves = 0;
  for (let i = 1; i < segments.length; i += 1) {
    const delta = segments[i].span - segments[i - 1].span;
    if (delta > 0) expansion += 1;
    if (delta < 0) contraction += 1;
    if (delta !== 0) motionTransitions += 1;
    const bassMoves = segments[i].bassMidi !== segments[i - 1].bassMidi;
    const topMoves = segments[i].topMidi !== segments[i - 1].topMidi;
    if (bassMoves || topMoves) {
      anyBassTopMoves += 1;
      if (bassMoves !== topMoves) independentMoves += 1;
    }
  }

  const maxSpan = segments.reduce((max, segment) => Math.max(max, segment.span), 0);
  const climaxSegment = segments.find((segment) => segment.span === maxSpan) || null;

  return Object.freeze({
    totalPitchSpan: maxMidi - minMidi,
    minMidi,
    maxMidi,
    medianMidi,
    durationWeightedMedianMidi,
    meanBassMidi: segments.length ? weightedMean(segments, (segment) => segment.bassMidi, soundingDurationSec) : null,
    meanTopMidi: segments.length ? weightedMean(segments, (segment) => segment.topMidi, soundingDurationSec) : null,
    meanBassTopSeparation: weightedMean(segments, (segment) => segment.span, soundingDurationSec),
    simultaneityCardinality,
    meanSimultaneity: weightedMean(segments, (segment) => segment.cardinality, soundingDurationSec),
    attackDensityPerSecond: pieceDuration > 0 ? events.length / pieceDuration : events.length,
    spanSlopeSemitonesPerNormalizedTime: weightedSlope(segments, (segment) => segment.span, start, end),
    expansionTransitionRate: motionTransitions ? expansion / motionTransitions : 0,
    contractionTransitionRate: motionTransitions ? contraction / motionTransitions : 0,
    sparseTextureShare: soundingDurationSec > 0
      ? segments.reduce((sum, segment) => sum + (segment.cardinality <= 2 ? segment.duration : 0), 0) / soundingDurationSec
      : 0,
    denseTextureShare: soundingDurationSec > 0
      ? segments.reduce((sum, segment) => sum + (segment.cardinality >= 4 ? segment.duration : 0), 0) / soundingDurationSec
      : 0,
    registralClimaxPosition: climaxSegment && pieceDuration > 0 ? (climaxSegment.mid - start) / pieceDuration : null,
    bassTopIndependenceRate: anyBassTopMoves ? independentMoves / anyBassTopMoves : 0,
    soundingDurationSec,
    segmentCount: segments.length
  });
}
