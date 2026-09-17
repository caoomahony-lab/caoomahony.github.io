import { mod12 } from "../theory/pitch.js";
import { CHORD_TEMPLATES } from "../theory/chords.js";
import { voiceLeadingDistance } from "../theory/voice-leading.js";

const DEFAULT_RANGE = Object.freeze([36, 84]);
const DEFAULT_MAX_CANDIDATES = 2000;
const DEFAULT_MAX_SEARCH_NODES = 100000;

function assertInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw new TypeError(`${label} must be an integer`);
  return number;
}

function assertPositiveInteger(value, label) {
  const number = assertInteger(value, label);
  if (number < 1) throw new RangeError(`${label} must be at least 1`);
  return number;
}

function normalizeMidiRange(range) {
  if (!Array.isArray(range) || range.length !== 2) throw new TypeError("midiRange must be [minMidi, maxMidi]");
  const minMidi = assertInteger(range[0], "midiRange[0]");
  const maxMidi = assertInteger(range[1], "midiRange[1]");
  if (minMidi < 0 || maxMidi > 127 || minMidi > maxMidi) throw new RangeError("midiRange must satisfy 0 <= min <= max <= 127");
  return [minMidi, maxMidi];
}

function normalizePitchClasses(values, label) {
  if (values == null) return [];
  if (!Array.isArray(values) && !ArrayBuffer.isView(values) && typeof values[Symbol.iterator] !== "function") {
    throw new TypeError(`${label} must be iterable`);
  }
  return [...new Set(Array.from(values, (value) => mod12(assertInteger(value, label))))].sort((a, b) => a - b);
}

function resolveChord(chord) {
  if (!chord || typeof chord !== "object") throw new TypeError("chord must be an object");
  if (Array.isArray(chord.pitchClasses) || ArrayBuffer.isView(chord.pitchClasses)) {
    const pitchClasses = normalizePitchClasses(chord.pitchClasses, "chord.pitchClasses");
    if (!pitchClasses.length) throw new RangeError("chord.pitchClasses must not be empty");
    return {
      rootPc: chord.rootPc == null ? null : mod12(assertInteger(chord.rootPc, "chord.rootPc")),
      templateId: chord.templateId ?? null,
      pitchClasses,
      intervals: null
    };
  }
  if (chord.rootPc == null || !chord.templateId) {
    throw new TypeError("chord requires either pitchClasses or rootPc + templateId");
  }
  const rootPc = mod12(assertInteger(chord.rootPc, "chord.rootPc"));
  const template = CHORD_TEMPLATES.find((item) => item.id === chord.templateId);
  if (!template) throw new RangeError(`Unknown chord template: ${chord.templateId}`);
  return {
    rootPc,
    templateId: template.id,
    pitchClasses: [...new Set(template.intervals.map((interval) => mod12(rootPc + interval)))].sort((a, b) => a - b),
    intervals: [...template.intervals]
  };
}

function defaultOmittablePitchClasses(resolved, omissionPolicy) {
  if (omissionPolicy === "none" || resolved.rootPc == null || !resolved.intervals) return [];
  if (omissionPolicy !== "extended") throw new RangeError(`Unsupported omissionPolicy: ${omissionPolicy}`);
  const omittable = [];
  if (resolved.intervals.length >= 4 && resolved.intervals.includes(7)) omittable.push(mod12(resolved.rootPc + 7));
  return [...new Set(omittable)].sort((a, b) => a - b);
}

function legalMidiNotes(pitchClasses, minMidi, maxMidi) {
  const allowed = new Set(pitchClasses);
  const values = [];
  for (let midi = minMidi; midi <= maxMidi; midi += 1) {
    if (allowed.has(mod12(midi))) values.push(midi);
  }
  return values;
}

function summarizeVoicing(voicing, resolved) {
  const pitchClasses = voicing.map(mod12);
  const counts = new Map();
  for (const pc of pitchClasses) counts.set(pc, (counts.get(pc) || 0) + 1);
  const adjacentSpacings = voicing.slice(1).map((midi, index) => midi - voicing[index]);
  const bassPc = pitchClasses[0];
  const sopranoPc = pitchClasses[pitchClasses.length - 1];
  let inversionIndex = null;
  if (resolved.rootPc != null && resolved.intervals) {
    const bassInterval = mod12(bassPc - resolved.rootPc);
    const index = resolved.intervals.indexOf(bassInterval);
    inversionIndex = index >= 0 ? index : null;
  }
  return Object.freeze({
    midi: Object.freeze([...voicing]),
    pitchClasses: Object.freeze(pitchClasses),
    bassPc,
    sopranoPc,
    span: voicing[voicing.length - 1] - voicing[0],
    adjacentSpacings: Object.freeze(adjacentSpacings),
    inversionIndex,
    doublings: Object.freeze([...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([pitchClass, count]) => Object.freeze({ pitchClass, count }))
      .sort((a, b) => a.pitchClass - b.pitchClass))
  });
}

function voicingKey(voicing) {
  return voicing.join(",");
}

export function enumerateVoicings(chord, options = {}) {
  const resolved = resolveChord(chord);
  const [minMidi, maxMidi] = normalizeMidiRange(options.midiRange ?? DEFAULT_RANGE);
  const voiceCount = assertPositiveInteger(options.voiceCount ?? resolved.pitchClasses.length, "voiceCount");
  const maxCandidates = assertPositiveInteger(options.maxCandidates ?? DEFAULT_MAX_CANDIDATES, "maxCandidates");
  const maxSearchNodes = assertPositiveInteger(options.maxSearchNodes ?? DEFAULT_MAX_SEARCH_NODES, "maxSearchNodes");
  const maxSpan = options.maxSpan == null ? Infinity : Number(options.maxSpan);
  const maxAdjacentSpacing = options.maxAdjacentSpacing == null ? Infinity : Number(options.maxAdjacentSpacing);
  if (!(maxSpan >= 0)) throw new RangeError("maxSpan must be nonnegative");
  if (!(maxAdjacentSpacing >= 0)) throw new RangeError("maxAdjacentSpacing must be nonnegative");

  const allowDoubling = options.allowDoubling !== false;
  const allowUnisons = options.allowUnisons === true;
  const omissionPolicy = options.omissionPolicy ?? "none";
  const defaultOmittable = defaultOmittablePitchClasses(resolved, omissionPolicy);
  const omittablePitchClasses = new Set(normalizePitchClasses(options.omittablePitchClasses ?? defaultOmittable, "omittablePitchClasses"));
  const requiredOverride = options.requiredPitchClasses == null
    ? null
    : normalizePitchClasses(options.requiredPitchClasses, "requiredPitchClasses");
  const requiredPitchClasses = new Set(requiredOverride ?? resolved.pitchClasses.filter((pc) => !omittablePitchClasses.has(pc)));
  for (const pc of requiredPitchClasses) {
    if (!resolved.pitchClasses.includes(pc)) throw new RangeError(`required pitch class ${pc} is not in the chord`);
  }

  const fixedBassPc = options.fixedBassPc == null ? null : mod12(assertInteger(options.fixedBassPc, "fixedBassPc"));
  const fixedSopranoPc = options.fixedSopranoPc == null ? null : mod12(assertInteger(options.fixedSopranoPc, "fixedSopranoPc"));
  if (fixedBassPc != null && !resolved.pitchClasses.includes(fixedBassPc)) throw new RangeError("fixedBassPc must be a chord pitch class");
  if (fixedSopranoPc != null && !resolved.pitchClasses.includes(fixedSopranoPc)) throw new RangeError("fixedSopranoPc must be a chord pitch class");
  if (!allowDoubling && voiceCount > resolved.pitchClasses.length) return Object.freeze([]);
  if (requiredPitchClasses.size > voiceCount) return Object.freeze([]);

  const legalNotes = legalMidiNotes(resolved.pitchClasses, minMidi, maxMidi);
  if (!legalNotes.length) return Object.freeze([]);

  const results = [];
  const chosen = [];
  const pcCounts = new Map();
  let searchNodes = 0;
  let truncatedBySearchLimit = false;

  function canStillCoverRequired(depth, startIndex) {
    const remainingSlots = voiceCount - depth;
    const missing = [...requiredPitchClasses].filter((pc) => !pcCounts.get(pc));
    if (missing.length > remainingSlots) return false;
    if (!missing.length) return true;
    const availablePcs = new Set(legalNotes.slice(startIndex).map(mod12));
    return missing.every((pc) => availablePcs.has(pc));
  }

  function visit(depth, startIndex) {
    if (results.length >= maxCandidates || searchNodes >= maxSearchNodes) {
      if (searchNodes >= maxSearchNodes) truncatedBySearchLimit = true;
      return;
    }
    searchNodes += 1;

    if (depth === voiceCount) {
      const pcs = chosen.map(mod12);
      if ([...requiredPitchClasses].some((pc) => !pcs.includes(pc))) return;
      if (fixedBassPc != null && pcs[0] !== fixedBassPc) return;
      if (fixedSopranoPc != null && pcs[pcs.length - 1] !== fixedSopranoPc) return;
      results.push(summarizeVoicing(chosen, resolved));
      return;
    }
    if (!canStillCoverRequired(depth, startIndex)) return;

    for (let index = startIndex; index < legalNotes.length; index += 1) {
      if (results.length >= maxCandidates || searchNodes >= maxSearchNodes) break;
      const midi = legalNotes[index];
      const pc = mod12(midi);
      const previous = chosen[chosen.length - 1];
      if (previous != null) {
        const spacing = midi - previous;
        if (!allowUnisons && spacing === 0) continue;
        if (spacing > maxAdjacentSpacing) break;
        if (midi - chosen[0] > maxSpan) break;
      }
      if (!allowDoubling && (pcCounts.get(pc) || 0) > 0) continue;
      if (depth === 0 && fixedBassPc != null && pc !== fixedBassPc) continue;
      if (depth === voiceCount - 1 && fixedSopranoPc != null && pc !== fixedSopranoPc) continue;

      chosen.push(midi);
      pcCounts.set(pc, (pcCounts.get(pc) || 0) + 1);
      visit(depth + 1, allowUnisons ? index : index + 1);
      const nextCount = pcCounts.get(pc) - 1;
      if (nextCount) pcCounts.set(pc, nextCount);
      else pcCounts.delete(pc);
      chosen.pop();
    }
  }

  visit(0, 0);

  const deduped = [...new Map(results.map((item) => [voicingKey(item.midi), item])).values()];
  deduped.sort((a, b) =>
    a.span - b.span ||
    a.midi[0] - b.midi[0] ||
    a.midi[a.midi.length - 1] - b.midi[b.midi.length - 1] ||
    voicingKey(a.midi).localeCompare(voicingKey(b.midi), "en", { numeric: true })
  );

  Object.defineProperty(deduped, "searchMetadata", {
    value: Object.freeze({
      searchNodes,
      truncatedByCandidateLimit: results.length >= maxCandidates,
      truncatedBySearchLimit,
      maxCandidates,
      maxSearchNodes
    }),
    enumerable: false
  });
  return Object.freeze(deduped);
}

export function rankVoicingsByVoiceLeading(sourceVoicing, candidateVoicings, {
  limit = 20,
  voiceLeadingOptions = {}
} = {}) {
  if (!Array.isArray(candidateVoicings)) throw new TypeError("candidateVoicings must be an array");
  const resolvedLimit = assertPositiveInteger(limit, "limit");
  const ranked = candidateVoicings.map((candidate, index) => {
    const midi = Array.isArray(candidate) ? candidate : candidate?.midi;
    if (!Array.isArray(midi)) throw new TypeError(`candidateVoicings[${index}] must be a MIDI array or voicing record`);
    const voiceLeading = voiceLeadingDistance(sourceVoicing, midi, voiceLeadingOptions);
    return Object.freeze({
      rankSourceIndex: index,
      voicing: candidate,
      voiceLeading
    });
  });
  ranked.sort((a, b) =>
    a.voiceLeading.cost - b.voiceLeading.cost ||
    a.voiceLeading.movementSemitones - b.voiceLeading.movementSemitones ||
    b.voiceLeading.commonToneCount - a.voiceLeading.commonToneCount ||
    voicingKey(Array.isArray(a.voicing) ? a.voicing : a.voicing.midi)
      .localeCompare(voicingKey(Array.isArray(b.voicing) ? b.voicing : b.voicing.midi), "en", { numeric: true })
  );
  return Object.freeze(ranked.slice(0, resolvedLimit));
}
