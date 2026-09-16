import { mod12 } from "../theory/pitch.js";

export const NOTE_EVENT_SCHEMA_VERSION = 1;
export const NOTE_EVENT_TYPE = "note";
export const NOTE_EVENT_SOURCES = Object.freeze(["musicxml", "midi", "manual"]);

function assertFiniteNumber(value, name, { min = -Infinity, integer = false } = {}) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number`);
  if (value < min) throw new RangeError(`${name} must be >= ${min}`);
  if (integer && !Number.isInteger(value)) throw new TypeError(`${name} must be an integer`);
  return value;
}

function optionalInteger(value) {
  if (value == null || value === "") return undefined;
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : undefined;
}

function stableIdToken(value) {
  return encodeURIComponent(String(value).trim()).replaceAll("%", "_");
}

export function makeNoteEventId({ trackId, source = "musicxml", sourceOrdinal = 0 }) {
  if (typeof trackId !== "string" || !trackId.trim()) throw new TypeError("trackId must be a non-empty string");
  if (!NOTE_EVENT_SOURCES.includes(source)) throw new RangeError(`Unsupported note-event source: ${source}`);
  const ordinal = assertFiniteNumber(Number(sourceOrdinal), "sourceOrdinal", { min: 0, integer: true });
  return `nev1:${stableIdToken(trackId)}:${source}:${ordinal.toString(36)}`;
}

export function createNoteEventV1(input) {
  if (!input || typeof input !== "object") throw new TypeError("NoteEventV1 input must be an object");

  const trackId = String(input.trackId || "").trim();
  if (!trackId) throw new TypeError("trackId must be a non-empty string");

  const source = input.source || "musicxml";
  if (!NOTE_EVENT_SOURCES.includes(source)) throw new RangeError(`Unsupported note-event source: ${source}`);

  const sourceOrdinal = assertFiniteNumber(Number(input.sourceOrdinal ?? 0), "sourceOrdinal", { min: 0, integer: true });
  const onsetSec = assertFiniteNumber(Number(input.onsetSec), "onsetSec", { min: 0 });
  const durationSec = assertFiniteNumber(Number(input.durationSec), "durationSec", { min: 0 });
  const endSec = onsetSec + durationSec;
  const midi = assertFiniteNumber(Number(input.midi), "midi", { min: 0, integer: true });
  if (midi > 127) throw new RangeError("midi must be <= 127");

  const pitchClass = mod12(input.pitchClass ?? midi);
  const octave = assertFiniteNumber(Number(input.octave), "octave", { integer: true });
  const spelling = input.spelling == null ? undefined : String(input.spelling);
  const velocity = input.velocity == null
    ? null
    : assertFiniteNumber(Number(input.velocity), "velocity", { min: 0 });

  const event = {
    schemaVersion: NOTE_EVENT_SCHEMA_VERSION,
    eventType: NOTE_EVENT_TYPE,
    id: input.id || makeNoteEventId({ trackId, source, sourceOrdinal }),
    trackId,
    partId: input.partId == null ? undefined : String(input.partId),
    voice: optionalInteger(input.voice),
    staff: optionalInteger(input.staff),
    measure: optionalInteger(input.measure),
    measureNumber: input.measureNumber == null ? undefined : String(input.measureNumber),
    onsetSec,
    durationSec,
    endSec,
    scoreOnsetQuarterBeat: Number.isFinite(Number(input.scoreOnsetQuarterBeat))
      ? Number(input.scoreOnsetQuarterBeat)
      : undefined,
    scoreDurationQuarterBeats: Number.isFinite(Number(input.scoreDurationQuarterBeats))
      ? Math.max(0, Number(input.scoreDurationQuarterBeats))
      : undefined,
    midi,
    pitchClass,
    octave,
    spelling,
    velocity,
    tieStart: Boolean(input.tieStart),
    tieStop: Boolean(input.tieStop),
    grace: Boolean(input.grace),
    source,
    sourceOrdinal
  };

  return Object.freeze(event);
}

export function canonicalizeNoteEvents(notes, { trackId, source = "musicxml" } = {}) {
  if (!Array.isArray(notes)) throw new TypeError("notes must be an array");
  const canonicalTrackId = String(trackId || "").trim();
  if (!canonicalTrackId) throw new TypeError("canonicalizeNoteEvents requires trackId");

  return Object.freeze(notes.map((note, index) => createNoteEventV1({
    trackId: canonicalTrackId,
    source,
    sourceOrdinal: note.sourceOrdinal ?? index,
    partId: note.partId ?? (note.partIndex == null ? undefined : String(Number(note.partIndex) + 1)),
    voice: note.voice,
    staff: note.staff,
    measure: note.measureIndex,
    measureNumber: note.measureNumber,
    onsetSec: note.onset,
    durationSec: note.duration,
    scoreOnsetQuarterBeat: note.qBeat,
    scoreDurationQuarterBeats: note.durationQ,
    midi: note.midi,
    pitchClass: note.pitchClass,
    octave: note.octave,
    spelling: note.spelling,
    velocity: note.velocity ?? null,
    tieStart: note.tieStart,
    tieStop: note.tieStop,
    grace: note.isGrace
  })));
}

export function validateNoteEventV1(event) {
  if (!event || event.schemaVersion !== NOTE_EVENT_SCHEMA_VERSION || event.eventType !== NOTE_EVENT_TYPE) return false;
  if (typeof event.id !== "string" || !event.id) return false;
  if (typeof event.trackId !== "string" || !event.trackId) return false;
  if (!NOTE_EVENT_SOURCES.includes(event.source)) return false;
  if (!Number.isFinite(event.onsetSec) || event.onsetSec < 0) return false;
  if (!Number.isFinite(event.durationSec) || event.durationSec < 0) return false;
  if (!Number.isFinite(event.endSec) || Math.abs(event.endSec - (event.onsetSec + event.durationSec)) > 1e-9) return false;
  if (!Number.isInteger(event.midi) || event.midi < 0 || event.midi > 127) return false;
  if (!Number.isInteger(event.pitchClass) || event.pitchClass < 0 || event.pitchClass > 11) return false;
  if (!Number.isInteger(event.octave)) return false;
  if (!Number.isInteger(event.sourceOrdinal) || event.sourceOrdinal < 0) return false;
  return true;
}
