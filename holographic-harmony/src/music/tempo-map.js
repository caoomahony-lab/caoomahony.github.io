export function normalizeTempoEvents(events = []) {
  const sorted = [...events]
    .filter((e) => Number.isFinite(e.qBeat) && Number.isFinite(e.bpm) && e.bpm > 0)
    .sort((a, b) => a.qBeat - b.qBeat);

  const deduped = [];
  for (const event of sorted) {
    if (deduped.length && Math.abs(deduped[deduped.length - 1].qBeat - event.qBeat) < 1e-9) {
      deduped[deduped.length - 1] = event;
    } else {
      deduped.push(event);
    }
  }
  if (!deduped.length || deduped[0].qBeat > 0) deduped.unshift({ qBeat: 0, bpm: 120 });
  return deduped;
}

export function quarterBeatToSeconds(qBeat, tempoEvents = []) {
  const tempos = normalizeTempoEvents(tempoEvents);
  const target = Math.max(0, qBeat);
  let seconds = 0;
  let cursor = 0;
  let bpm = tempos[0].bpm;

  for (let i = 1; i < tempos.length; i += 1) {
    const next = tempos[i];
    if (next.qBeat >= target) break;
    seconds += (next.qBeat - cursor) * (60 / bpm);
    cursor = next.qBeat;
    bpm = next.bpm;
  }
  seconds += (target - cursor) * (60 / bpm);
  return seconds;
}

export function applyTempoMap(noteEvents, tempoEvents) {
  const tempos = normalizeTempoEvents(tempoEvents);
  return noteEvents.map((event) => {
    const onset = quarterBeatToSeconds(event.qBeat, tempos);
    const end = quarterBeatToSeconds(event.qBeat + event.durationQ, tempos);
    return { ...event, onset, duration: Math.max(0, end - onset) };
  }).sort((a, b) => a.onset - b.onset || a.pitchClass - b.pitchClass);
}
