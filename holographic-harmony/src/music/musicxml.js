import { pitchClassFromStepAlter, midiFromPitch, noteName } from "../theory/pitch.js";
import { applyTempoMap, normalizeTempoEvents } from "./tempo-map.js";
import { canonicalizeNoteEvents, NOTE_EVENT_SCHEMA_VERSION } from "../model/events.js";

function childrenByTag(node, tag) {
  return Array.from(node.childNodes || []).filter((child) => child.nodeType === 1 && child.nodeName === tag);
}

function firstChild(node, tag) {
  return childrenByTag(node, tag)[0] || null;
}

function textOf(node, tag, fallback = "") {
  const child = firstChild(node, tag);
  return child?.textContent?.trim() ?? fallback;
}

function numberOf(node, tag, fallback = 0) {
  const value = Number(textOf(node, tag, fallback));
  return Number.isFinite(value) ? value : fallback;
}

function parseTempoFromDirection(direction) {
  const sound = firstChild(direction, "sound");
  if (sound?.getAttribute?.("tempo")) {
    const bpm = Number(sound.getAttribute("tempo"));
    if (Number.isFinite(bpm) && bpm > 0) return bpm;
  }
  const directionTypes = childrenByTag(direction, "direction-type");
  for (const dt of directionTypes) {
    const metronome = firstChild(dt, "metronome");
    if (!metronome) continue;
    const perMinute = Number(textOf(metronome, "per-minute", ""));
    if (Number.isFinite(perMinute) && perMinute > 0) return perMinute;
  }
  return null;
}

function tieFlags(note) {
  let tieStart = false;
  let tieStop = false;
  for (const tie of childrenByTag(note, "tie")) {
    const type = tie.getAttribute?.("type");
    if (type === "start") tieStart = true;
    if (type === "stop") tieStop = true;
  }
  const notations = firstChild(note, "notations");
  if (notations) {
    for (const tied of childrenByTag(notations, "tied")) {
      const type = tied.getAttribute?.("type");
      if (type === "start") tieStart = true;
      if (type === "stop") tieStop = true;
    }
  }
  return { tieStart, tieStop };
}

export function parseMusicXML(xmlText, DOMParserImpl = globalThis.DOMParser, options = {}) {
  if (!DOMParserImpl) throw new Error("DOMParser is unavailable in this environment");
  const doc = new DOMParserImpl().parseFromString(xmlText, "application/xml");
  const parserError = doc.getElementsByTagName?.("parsererror")?.[0];
  if (parserError) throw new Error(`Invalid MusicXML: ${parserError.textContent}`);

  const partNodes = Array.from(doc.getElementsByTagName("part") || []);
  const rawNotes = [];
  const tempoEvents = [];
  const timeSignatureEvents = [];
  const measureMap = [];
  let globalEndQ = 0;

  partNodes.forEach((part, partIndex) => {
    const partId = part.getAttribute?.("id") || String(partIndex + 1);
    let divisions = 1;
    let measureStartQ = 0;
    let beats = 4;
    let beatType = 4;
    const measures = childrenByTag(part, "measure");

    measures.forEach((measure, measureIndex) => {
      const attributes = firstChild(measure, "attributes");
      if (attributes) {
        const newDivisions = numberOf(attributes, "divisions", divisions);
        if (newDivisions > 0) divisions = newDivisions;
        const time = firstChild(attributes, "time");
        if (time) {
          const nextBeats = Number(textOf(time, "beats", beats));
          const nextBeatType = Number(textOf(time, "beat-type", beatType));
          if (nextBeats > 0 && nextBeatType > 0) {
            beats = nextBeats;
            beatType = nextBeatType;
            timeSignatureEvents.push({ qBeat: measureStartQ, beats, beatType, partIndex });
          }
        }
      }

      let cursorDiv = 0;
      let maxCursorDiv = 0;
      let lastNonChordOnsetDiv = 0;

      for (const child of Array.from(measure.childNodes || [])) {
        if (child.nodeType !== 1) continue;

        if (child.nodeName === "direction") {
          const bpm = parseTempoFromDirection(child);
          if (bpm) {
            const offsetDiv = numberOf(child, "offset", 0);
            tempoEvents.push({ qBeat: measureStartQ + (cursorDiv + offsetDiv) / divisions, bpm });
          }
          continue;
        }

        if (child.nodeName === "backup") {
          cursorDiv -= numberOf(child, "duration", 0);
          cursorDiv = Math.max(0, cursorDiv);
          continue;
        }

        if (child.nodeName === "forward") {
          cursorDiv += numberOf(child, "duration", 0);
          maxCursorDiv = Math.max(maxCursorDiv, cursorDiv);
          continue;
        }

        if (child.nodeName !== "note") continue;

        const isChord = Boolean(firstChild(child, "chord"));
        const isRest = Boolean(firstChild(child, "rest"));
        const isGrace = Boolean(firstChild(child, "grace"));
        const durationDiv = isGrace ? 0 : numberOf(child, "duration", 0);
        const onsetDiv = isChord ? lastNonChordOnsetDiv : cursorDiv;
        if (!isChord) lastNonChordOnsetDiv = onsetDiv;
        const qBeat = measureStartQ + onsetDiv / divisions;
        const durationQ = durationDiv / divisions;
        const voice = textOf(child, "voice", "1");
        const staff = Number(textOf(child, "staff", "1")) || 1;
        const { tieStart, tieStop } = tieFlags(child);

        if (!isRest) {
          const pitch = firstChild(child, "pitch");
          if (pitch) {
            const step = textOf(pitch, "step", "C");
            const alter = numberOf(pitch, "alter", 0);
            const octave = numberOf(pitch, "octave", 4);
            rawNotes.push({
              sourceOrdinal: rawNotes.length,
              partIndex,
              partId,
              measureIndex: measureIndex + 1,
              measureNumber: measure.getAttribute?.("number") || String(measureIndex + 1),
              voice,
              staff,
              step,
              alter,
              octave,
              spelling: noteName(step, alter),
              pitch: noteName(step, alter, octave),
              pitchClass: pitchClassFromStepAlter(step, alter),
              midi: midiFromPitch(step, alter, octave),
              qBeat,
              durationQ,
              tieStart,
              tieStop,
              isGrace,
              isRest: false
            });
          }
        }

        if (!isChord) {
          cursorDiv += durationDiv;
          maxCursorDiv = Math.max(maxCursorDiv, cursorDiv);
        }
      }

      const measureLengthQ = maxCursorDiv / divisions;
      const measureEndQ = measureStartQ + measureLengthQ;
      measureMap.push(Object.freeze({
        partIndex,
        partId,
        measureIndex: measureIndex + 1,
        measureNumber: measure.getAttribute?.("number") || String(measureIndex + 1),
        startQ: measureStartQ,
        endQ: measureEndQ,
        beats,
        beatType
      }));
      measureStartQ = measureEndQ;
      globalEndQ = Math.max(globalEndQ, measureStartQ);
    });
  });

  const tempos = normalizeTempoEvents(tempoEvents);
  const notes = applyTempoMap(rawNotes, tempos);
  const durationSeconds = notes.reduce((max, n) => Math.max(max, n.onset + n.duration), 0);
  const trackId = String(options.trackId || "musicxml");
  const eventsV1 = canonicalizeNoteEvents(notes, { trackId, source: "musicxml" });

  return {
    notes,
    eventsV1,
    eventSchemaVersion: NOTE_EVENT_SCHEMA_VERSION,
    tempoEvents: tempos,
    timeSignatureEvents: Object.freeze([...timeSignatureEvents]),
    measureMap: Object.freeze(measureMap),
    durationSeconds,
    durationQuarterBeats: globalEndQ,
    parts: partNodes.length,
    sourceFormat: "musicxml",
    evidenceClass: "measured-from-score"
  };
}
