import { parseChordSymbol, parseRegisteredVoicing } from "./chord-symbols.js";

function tokenizeSequence(text) {
  const source = String(text ?? "").trim();
  if (!source) throw new TypeError("chord sequence must not be empty");
  const hasExplicitSeparators = /[|,;\n]/.test(source);
  const tokens = (hasExplicitSeparators ? source.split(/[|,;\n]+/) : source.split(/\s+/))
    .map((token) => token.trim())
    .filter(Boolean);
  if (!tokens.length) throw new TypeError("chord sequence must contain at least one chord");
  return tokens;
}

export function parseChordSequence(text) {
  const source = String(text ?? "").trim();
  const tokens = tokenizeSequence(source);
  const chords = Object.freeze(tokens.map((token, index) => Object.freeze({
    index,
    ...parseChordSymbol(token)
  })));
  return Object.freeze({
    source,
    chords,
    analysisSequence: Object.freeze(chords.map((chord) => Object.freeze({
      pcs: chord.pitchClasses,
      bassPc: chord.bassPc,
      weight: 1
    }))),
    currentChord: Object.freeze({
      rootPc: chords[chords.length - 1].rootPc,
      templateId: chords[chords.length - 1].templateId,
      pitchClasses: chords[chords.length - 1].pitchClasses,
      bassPc: chords[chords.length - 1].bassPc
    })
  });
}

export function parseContinuationInput({ progression, currentVoicing = "" } = {}) {
  const sequence = parseChordSequence(progression);
  const voicing = parseRegisteredVoicing(currentVoicing);
  return Object.freeze({ sequence, currentVoicing: voicing });
}
