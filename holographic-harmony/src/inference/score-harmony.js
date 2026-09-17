import { rankChordCandidates } from "../theory/chords.js";
import { analyzeHarmonicObjectSequence } from "../analysis/harmonic-objects.js";

export const SCORE_HARMONY_VERSION = "score-harmony-v1";

const EPSILON = 1e-9;

function mod12(value) {
  return ((Number(value) % 12) + 12) % 12;
}

function finiteNumber(value, fallback = null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeNote(note, index) {
  if (!note || typeof note !== "object") return null;
  const onset = finiteNumber(note.onsetSec, finiteNumber(note.onset));
  const duration = finiteNumber(note.durationSec, finiteNumber(note.duration));
  const midi = finiteNumber(note.midi);
  if (onset == null || duration == null || midi == null || duration <= EPSILON) return null;
  const end = finiteNumber(note.endSec, onset + duration);
  if (end == null || end - onset <= EPSILON) return null;
  return Object.freeze({
    sourceIndex: index,
    sourceId: note.id == null ? null : String(note.id),
    onset,
    end,
    midi,
    pitchClass: mod12(note.pitchClass ?? midi),
    tieStart: Boolean(note.tieStart),
    tieStop: Boolean(note.tieStop)
  });
}

function samePitchClasses(a, b) {
  return a.length === b.length && a.every((pc, index) => pc === b[index]);
}

function measuredState(notes) {
  const ordered = [...notes].sort((a, b) => a.midi - b.midi || a.sourceIndex - b.sourceIndex);
  const pitchClasses = Object.freeze([...new Set(ordered.map((note) => note.pitchClass))].sort((a, b) => a - b));
  const bass = ordered[0] || null;
  return Object.freeze({
    pitchClasses,
    bassMidi: bass?.midi ?? null,
    bassPc: bass?.pitchClass ?? null,
    sourceNoteIndices: Object.freeze(ordered.map((note) => note.sourceIndex)),
    sourceNoteIds: Object.freeze(ordered.map((note) => note.sourceId).filter(Boolean))
  });
}

function interpretationFor(state, options) {
  const candidates = rankChordCandidates(state.pitchClasses, {
    bassPc: state.bassPc,
    preferFlats: options.preferFlats === true,
    limit: Math.max(1, Number(options.candidateLimit ?? 6)),
    minSupport: Number(options.minChordSupport ?? 0)
  }).map((candidate) => Object.freeze({
    ...candidate,
    evidenceClass: "inferred-from-score-sonority"
  }));
  return Object.freeze(candidates);
}

function makeRegion(interval, index, options) {
  const candidates = interpretationFor(interval.state, options);
  const top = candidates[0] || null;
  return Object.freeze({
    index,
    onset: interval.onset,
    end: interval.end,
    duration: interval.end - interval.onset,
    measuredPitchClasses: interval.state.pitchClasses,
    pcs: interval.state.pitchClasses,
    measuredBassMidi: interval.state.bassMidi,
    bassPc: interval.state.bassPc,
    measuredSourceNoteIndices: interval.state.sourceNoteIndices,
    measuredSourceNoteIds: interval.state.sourceNoteIds,
    candidates,
    symbol: top?.symbol ?? null,
    rootPc: top?.rootPc ?? null,
    templateId: top?.templateId ?? null,
    measuredEvidenceClass: "measured-from-score",
    interpretationEvidenceClass: "inferred-from-score-sonority",
    mergeRule: interval.mergeCount > 0
      ? "adjacent-equivalent-measured-pitch-classes-and-bass"
      : "score-onset-offset-boundary",
    mergedIntervalCount: interval.mergeCount + 1
  });
}

export function inferScoreHarmony(notesRaw, options = {}) {
  if (!Array.isArray(notesRaw)) throw new TypeError("notes must be an array");
  const notes = notesRaw.map(normalizeNote).filter(Boolean);
  if (!notes.length) {
    return Object.freeze({
      version: SCORE_HARMONY_VERSION,
      evidenceClass: "measured-score-sonority-with-inferred-interpretation",
      regionCount: 0,
      regions: Object.freeze([]),
      harmonicAnalysis: null,
      note: "Sounding pitch classes and bass are measured from score events; chord roots, qualities, and functions are inferred interpretations."
    });
  }

  const boundaries = [...new Set(notes.flatMap((note) => [note.onset, note.end]))]
    .sort((a, b) => a - b);
  const intervals = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const onset = boundaries[index];
    const end = boundaries[index + 1];
    if (end - onset <= EPSILON) continue;
    const sounding = notes.filter((note) => note.onset < end - EPSILON && note.end > onset + EPSILON);
    if (!sounding.length) continue;
    const state = measuredState(sounding);
    const previous = intervals.at(-1);
    if (
      previous &&
      Math.abs(previous.end - onset) <= EPSILON &&
      previous.state.bassMidi === state.bassMidi &&
      samePitchClasses(previous.state.pitchClasses, state.pitchClasses)
    ) {
      previous.end = end;
      previous.mergeCount += 1;
      previous.state = Object.freeze({
        ...previous.state,
        sourceNoteIndices: Object.freeze([...new Set([
          ...previous.state.sourceNoteIndices,
          ...state.sourceNoteIndices
        ])].sort((a, b) => a - b)),
        sourceNoteIds: Object.freeze([...new Set([
          ...previous.state.sourceNoteIds,
          ...state.sourceNoteIds
        ])])
      });
    } else {
      intervals.push({ onset, end, state, mergeCount: 0 });
    }
  }

  const regions = Object.freeze(intervals.map((interval, index) => makeRegion(interval, index, options)));
  let harmonicAnalysis = null;
  try {
    const sequence = regions.map((region) => ({
      pcs: region.measuredPitchClasses,
      bassPc: region.bassPc,
      weight: region.duration
    }));
    harmonicAnalysis = sequence.length ? analyzeHarmonicObjectSequence(sequence) : null;
  } catch {
    harmonicAnalysis = null;
  }

  return Object.freeze({
    version: SCORE_HARMONY_VERSION,
    evidenceClass: "measured-score-sonority-with-inferred-interpretation",
    regionCount: regions.length,
    regions,
    harmonicAnalysis,
    note: "Sounding pitch classes and bass are measured from score events; chord roots, qualities, and functions are inferred interpretations."
  });
}
