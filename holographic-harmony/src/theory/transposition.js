import { mod12, pitchClassName } from "./pitch.js";

function assertSemitones(value) {
  const semitones = Number(value);
  if (!Number.isInteger(semitones)) throw new TypeError("semitones must be an integer");
  return semitones;
}

function assertHistogram(histogram) {
  if (!Array.isArray(histogram) && !ArrayBuffer.isView(histogram)) {
    throw new TypeError("histogram must be an array-like sequence");
  }
  if (histogram.length !== 12) throw new RangeError("histogram must contain exactly 12 bins");
  return Array.from(histogram, (value, index) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) throw new TypeError(`histogram[${index}] must be finite`);
    return numeric;
  });
}

export function transposePitchClass(pc, semitones) {
  return mod12(Number(pc) + assertSemitones(semitones));
}

export function transposePitchSet(pcs, semitones) {
  if (!pcs || typeof pcs[Symbol.iterator] !== "function") throw new TypeError("pcs must be iterable");
  const shift = assertSemitones(semitones);
  return Object.freeze([...new Set(Array.from(pcs, (pc) => transposePitchClass(pc, shift)))].sort((a, b) => a - b));
}

export function rotateHistogram(histogram, semitones) {
  const input = assertHistogram(histogram);
  const shift = assertSemitones(semitones);
  const output = Array(12).fill(0);
  for (let pc = 0; pc < 12; pc += 1) {
    output[transposePitchClass(pc, shift)] = input[pc];
  }
  return Object.freeze(output);
}

export function normalizeToCenter(histogram, centerPc) {
  return rotateHistogram(histogram, -mod12(centerPc));
}

export function transposeEvents(events, semitones, options = {}) {
  if (!Array.isArray(events)) throw new TypeError("events must be an array");
  const shift = assertSemitones(semitones);
  const spellingPolicy = options.spellingPolicy || "derived";
  if (!new Set(["derived", "sharp", "flat", "omit"]).has(spellingPolicy)) {
    throw new RangeError(`Unsupported spellingPolicy: ${spellingPolicy}`);
  }

  return Object.freeze(events.map((event) => {
    if (!event || !Number.isInteger(event.midi)) throw new TypeError("transposeEvents requires events with integer MIDI pitches");
    const midi = event.midi + shift;
    if (midi < 0 || midi > 127) {
      throw new RangeError(`Transposition moves MIDI ${event.midi} outside 0..127`);
    }
    const pitchClass = mod12(midi);
    const octave = Math.floor(midi / 12) - 1;
    let spelling;
    if (spellingPolicy === "sharp") spelling = pitchClassName(pitchClass, false);
    else if (spellingPolicy === "flat") spelling = pitchClassName(pitchClass, true);
    else if (spellingPolicy === "omit") spelling = undefined;
    else spelling = pitchClassName(pitchClass, options.preferFlats === true);

    return Object.freeze({
      ...event,
      id: `${event.id}@t${shift >= 0 ? "+" : ""}${shift}`,
      derivedFromId: event.derivedFromId || event.id,
      sourceSpelling: event.sourceSpelling ?? event.spelling,
      transpositionSemitones: (event.transpositionSemitones || 0) + shift,
      midi,
      pitchClass,
      octave,
      spelling
    });
  }));
}
