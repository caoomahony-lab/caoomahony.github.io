import { applyTempoMap, normalizeTempoEvents } from "./tempo-map.js";
import { canonicalizeNoteEvents, NOTE_EVENT_SCHEMA_VERSION } from "../model/events.js";
import { noteName } from "../theory/pitch.js";

export const MIDI_IMPORT_VERSION = "midi-import-v1";

function readAscii(bytes, offset, length) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}
function readUint16(view, offset) { return view.getUint16(offset, false); }
function readUint32(view, offset) { return view.getUint32(offset, false); }

function readVlq(bytes, state) {
  let value = 0;
  let count = 0;
  while (state.offset < bytes.length && count < 4) {
    const byte = bytes[state.offset++];
    value = (value << 7) | (byte & 0x7f);
    count += 1;
    if ((byte & 0x80) === 0) return value;
  }
  throw new Error("Invalid MIDI variable-length quantity");
}

function midiSpelling(midi) {
  const names = [
    ["C", 0], ["C", 1], ["D", 0], ["D", 1], ["E", 0], ["F", 0],
    ["F", 1], ["G", 0], ["G", 1], ["A", 0], ["A", 1], ["B", 0]
  ];
  const pc = ((midi % 12) + 12) % 12;
  const [step, alter] = names[pc];
  const octave = Math.floor(midi / 12) - 1;
  return { step, alter, octave, spelling: noteName(step, alter), pitch: noteName(step, alter, octave) };
}

function closeOpenNote(openNotes, notes, key, endTick, trackIndex) {
  const queue = openNotes.get(key);
  if (!queue?.length) return;
  const started = queue.shift();
  if (!queue.length) openNotes.delete(key);
  const durationTicks = Math.max(0, endTick - started.startTick);
  const spelling = midiSpelling(started.midi);
  notes.push({
    sourceOrdinal: notes.length,
    partIndex: trackIndex,
    partId: `MIDI-${trackIndex + 1}`,
    measureIndex: null,
    measureNumber: null,
    voice: String(started.channel + 1),
    staff: 1,
    ...spelling,
    pitchClass: ((started.midi % 12) + 12) % 12,
    midi: started.midi,
    tick: started.startTick,
    durationTicks,
    velocity: started.velocity,
    tieStart: false,
    tieStop: false,
    isGrace: durationTicks === 0,
    isRest: false
  });
}

export function parseMidiFile(arrayBuffer, options = {}) {
  const bytes = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 14 || readAscii(bytes, 0, 4) !== "MThd") throw new Error("Invalid MIDI: missing MThd header");
  const headerLength = readUint32(view, 4);
  if (headerLength < 6 || 8 + headerLength > bytes.length) throw new Error("Invalid MIDI header length");
  const format = readUint16(view, 8);
  const trackCount = readUint16(view, 10);
  const division = readUint16(view, 12);
  if (division & 0x8000) throw new Error("SMPTE-time MIDI is not supported; PPQ MIDI is required");
  if (!(division > 0)) throw new Error("Invalid MIDI PPQ division");
  if (format > 2) throw new Error(`Unsupported MIDI format ${format}`);

  let offset = 8 + headerLength;
  const rawNotes = [];
  const tempoEvents = [];
  const timeSignatureEvents = [];
  const trackNames = [];
  let globalEndTick = 0;

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
    if (offset + 8 > bytes.length || readAscii(bytes, offset, 4) !== "MTrk") throw new Error(`Invalid MIDI track ${trackIndex + 1}`);
    const length = readUint32(view, offset + 4);
    const trackStart = offset + 8;
    const trackEnd = trackStart + length;
    if (trackEnd > bytes.length) throw new Error("Truncated MIDI track");
    const state = { offset: trackStart };
    let tick = 0;
    let runningStatus = null;
    const openNotes = new Map();

    while (state.offset < trackEnd) {
      tick += readVlq(bytes, state);
      globalEndTick = Math.max(globalEndTick, tick);
      if (state.offset >= trackEnd) break;
      let status = bytes[state.offset++];
      let firstData = null;
      if (status < 0x80) {
        if (runningStatus == null) throw new Error("MIDI running status used before a channel status");
        firstData = status;
        status = runningStatus;
      } else if (status < 0xf0) {
        runningStatus = status;
      }

      if (status === 0xff) {
        runningStatus = null;
        if (state.offset >= trackEnd) throw new Error("Truncated MIDI meta event");
        const metaType = bytes[state.offset++];
        const metaLength = readVlq(bytes, state);
        const metaStart = state.offset;
        const metaEnd = metaStart + metaLength;
        if (metaEnd > trackEnd) throw new Error("Truncated MIDI meta payload");
        if (metaType === 0x51 && metaLength === 3) {
          const micros = (bytes[metaStart] << 16) | (bytes[metaStart + 1] << 8) | bytes[metaStart + 2];
          if (micros > 0) tempoEvents.push({ qBeat: tick / division, bpm: 60000000 / micros });
        } else if (metaType === 0x58 && metaLength >= 2) {
          const beats = bytes[metaStart];
          const beatType = 2 ** bytes[metaStart + 1];
          if (beats > 0 && beatType > 0) timeSignatureEvents.push({ qBeat: tick / division, beats, beatType });
        } else if (metaType === 0x03) {
          trackNames[trackIndex] = new TextDecoder().decode(bytes.slice(metaStart, metaEnd));
        }
        state.offset = metaEnd;
        if (metaType === 0x2f) break;
        continue;
      }

      if (status === 0xf0 || status === 0xf7) {
        runningStatus = null;
        const sysexLength = readVlq(bytes, state);
        state.offset += sysexLength;
        if (state.offset > trackEnd) throw new Error("Truncated MIDI SysEx payload");
        continue;
      }

      const kind = status & 0xf0;
      const channel = status & 0x0f;
      const dataLength = kind === 0xc0 || kind === 0xd0 ? 1 : 2;
      const data1 = firstData == null ? bytes[state.offset++] : firstData;
      const data2 = dataLength === 2 ? bytes[state.offset++] : null;
      if (data1 == null || (dataLength === 2 && data2 == null)) throw new Error("Truncated MIDI channel event");

      if (kind === 0x90 && data2 > 0) {
        const key = `${channel}:${data1}`;
        const queue = openNotes.get(key) || [];
        queue.push({ startTick: tick, midi: data1, velocity: data2, channel });
        openNotes.set(key, queue);
      } else if (kind === 0x80 || (kind === 0x90 && data2 === 0)) {
        closeOpenNote(openNotes, rawNotes, `${channel}:${data1}`, tick, trackIndex);
      }
    }

    for (const key of [...openNotes.keys()]) {
      while (openNotes.get(key)?.length) closeOpenNote(openNotes, rawNotes, key, tick, trackIndex);
    }
    offset = trackEnd;
  }

  const tempos = normalizeTempoEvents(tempoEvents);
  const notesWithScoreTime = rawNotes.map((note) => ({
    ...note,
    qBeat: note.tick / division,
    durationQ: note.durationTicks / division
  }));
  const notes = applyTempoMap(notesWithScoreTime, tempos);
  const durationSeconds = notes.reduce((max, note) => Math.max(max, note.onset + note.duration), 0);
  const durationQuarterBeats = Math.max(globalEndTick / division, ...notes.map((note) => note.qBeat + note.durationQ), 0);
  const trackId = String(options.trackId || "midi");
  const eventsV1 = canonicalizeNoteEvents(notes, { trackId, source: "midi" });

  const signatures = [...timeSignatureEvents]
    .sort((a, b) => a.qBeat - b.qBeat)
    .filter((event, index, list) => index === 0 || event.qBeat !== list[index - 1].qBeat || event.beats !== list[index - 1].beats || event.beatType !== list[index - 1].beatType);
  if (!signatures.length || signatures[0].qBeat > 0) signatures.unshift({ qBeat: 0, beats: 4, beatType: 4 });

  return Object.freeze({
    version: MIDI_IMPORT_VERSION,
    sourceFormat: "midi",
    evidenceClass: "encoded-from-midi",
    notes: Object.freeze(notes),
    eventsV1,
    eventSchemaVersion: NOTE_EVENT_SCHEMA_VERSION,
    tempoEvents: Object.freeze(tempos),
    timeSignatureEvents: Object.freeze(signatures),
    measureMap: Object.freeze([]),
    durationSeconds,
    durationQuarterBeats,
    parts: Math.max(1, trackCount),
    trackNames: Object.freeze(trackNames),
    ppq: division,
    midiFormat: format
  });
}
