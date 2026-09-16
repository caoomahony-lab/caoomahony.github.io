export const PC_NAMES_SHARP = Object.freeze([
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
]);

export const PC_NAMES_FLAT = Object.freeze([
  "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"
]);

const STEP_TO_PC = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });

export function mod12(value) {
  return ((Number(value) % 12) + 12) % 12;
}

export function pitchClassFromStepAlter(step, alter = 0) {
  const base = STEP_TO_PC[String(step).toUpperCase()];
  if (base === undefined) throw new Error(`Unsupported pitch step: ${step}`);
  return mod12(base + Number(alter || 0));
}

export function pitchClassName(pc, preferFlats = false) {
  return (preferFlats ? PC_NAMES_FLAT : PC_NAMES_SHARP)[mod12(pc)];
}

export function midiFromPitch(step, alter = 0, octave = 4) {
  return 12 * (Number(octave) + 1) + pitchClassFromStepAlter(step, alter);
}

export function pitchClassFromMidi(midi) {
  return mod12(midi);
}

export function noteName(step, alter = 0, octave = null) {
  const accidental = Number(alter) === 0
    ? ""
    : Number(alter) > 0
      ? "#".repeat(Number(alter))
      : "b".repeat(Math.abs(Number(alter)));
  return `${String(step).toUpperCase()}${accidental}${octave == null ? "" : octave}`;
}

export function sortPitchClasses(pcs) {
  return [...new Set(pcs.map(mod12))].sort((a, b) => a - b);
}
