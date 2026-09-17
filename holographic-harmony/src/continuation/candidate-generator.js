import { mod12 } from "../theory/pitch.js";
import { CHORD_TEMPLATES, chordSymbol, exactChordMatches } from "../theory/chords.js";
import { romanNumeralForChord, nashvilleNumberForChord } from "../theory/functions.js";
import { SCALE_SYSTEMS } from "../inference/scales.js";

const SOURCE_ORDER = Object.freeze([
  "diatonic",
  "secondary-dominant",
  "modal-mixture",
  "chromatic-mediant",
  "holographic-shadow",
  "corpus-observed",
  "user-style",
  "external"
]);

function assertInteger(value, label) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) throw new TypeError(`${label} must be an integer`);
  return numeric;
}

function normalizePcs(values, label) {
  if (values == null) return [];
  if (!Array.isArray(values) && !ArrayBuffer.isView(values) && typeof values[Symbol.iterator] !== "function") {
    throw new TypeError(`${label} must be iterable`);
  }
  return [...new Set(Array.from(values, (value) => mod12(assertInteger(value, label))))].sort((a, b) => a - b);
}

function systemById(systemId) {
  const system = SCALE_SYSTEMS.find((item) => item.id === systemId);
  if (!system) throw new RangeError(`Unknown systemId: ${systemId}`);
  return system;
}

function chordPcs(rootPc, templateId) {
  const template = CHORD_TEMPLATES.find((item) => item.id === templateId);
  if (!template) throw new RangeError(`Unknown chord template: ${templateId}`);
  return [...new Set(template.intervals.map((interval) => mod12(rootPc + interval)))].sort((a, b) => a - b);
}

function candidateKey(candidate) {
  if (candidate.rootPc != null && candidate.templateId) return `chord:${candidate.rootPc}:${candidate.templateId}`;
  return `set:${candidate.pitchClasses.join(".")}`;
}

function makeCandidate({ rootPc = null, templateId = null, pitchClasses, source, explanation, metadata = {} }, centerPc) {
  const pcs = normalizePcs(pitchClasses, "candidate.pitchClasses");
  if (!pcs.length) throw new RangeError("candidate pitchClasses must not be empty");
  let symbol = null;
  let roman = null;
  let nashville = null;
  if (rootPc != null && templateId) {
    const chord = { rootPc: mod12(rootPc), templateId, quality: templateId };
    symbol = chordSymbol(chord.rootPc, templateId);
    roman = romanNumeralForChord(chord, centerPc);
    nashville = nashvilleNumberForChord(chord, centerPc);
  }
  return {
    rootPc: rootPc == null ? null : mod12(rootPc),
    templateId,
    pitchClasses: pcs,
    symbol,
    roman,
    nashville,
    sources: [source],
    explanations: explanation ? [String(explanation)] : [],
    metadata: { ...metadata }
  };
}

function mergeCandidate(target, incoming) {
  for (const source of incoming.sources) if (!target.sources.includes(source)) target.sources.push(source);
  for (const explanation of incoming.explanations) if (!target.explanations.includes(explanation)) target.explanations.push(explanation);
  target.metadata = { ...target.metadata, ...incoming.metadata };
}

function addCandidate(map, candidate) {
  const key = candidateKey(candidate);
  const existing = map.get(key);
  if (existing) mergeCandidate(existing, candidate);
  else map.set(key, candidate);
}

function tertianSonority(systemPcsByDegree, degreeIndex, cardinality) {
  const offsets = cardinality === 4 ? [0, 2, 4, 6] : [0, 2, 4];
  return offsets.map((offset) => systemPcsByDegree[(degreeIndex + offset) % 7]);
}

function chordFromExactPcs(pcs) {
  const matches = exactChordMatches(pcs);
  if (!matches.length) return { rootPc: null, templateId: null, pitchClasses: normalizePcs(pcs, "pcs") };
  const preferred = matches
    .filter((match) => ["major", "minor", "diminished", "augmented", "dominant7", "major7", "minor7", "halfDiminished7", "diminished7"].includes(match.templateId))
    .sort((a, b) => a.rootPc - b.rootPc || a.templateId.localeCompare(b.templateId))[0] || matches[0];
  return { rootPc: preferred.rootPc, templateId: preferred.templateId, pitchClasses: [...preferred.pitchClasses] };
}

function addDiatonic(map, centerPc, system, includeSevenths) {
  const scale = system.intervals.map((interval) => mod12(centerPc + interval));
  for (let degreeIndex = 0; degreeIndex < 7; degreeIndex += 1) {
    const triad = chordFromExactPcs(tertianSonority(scale, degreeIndex, 3));
    addCandidate(map, makeCandidate({
      ...triad,
      source: "diatonic",
      explanation: `tertian triad on system degree ${degreeIndex + 1}`,
      metadata: { degreeIndex, degreeNumber: degreeIndex + 1, systemId: system.id, cardinality: 3 }
    }, centerPc));
    if (includeSevenths) {
      const seventh = chordFromExactPcs(tertianSonority(scale, degreeIndex, 4));
      addCandidate(map, makeCandidate({
        ...seventh,
        source: "diatonic",
        explanation: `tertian seventh chord on system degree ${degreeIndex + 1}`,
        metadata: { degreeIndex, degreeNumber: degreeIndex + 1, systemId: system.id, cardinality: 4 }
      }, centerPc));
    }
  }
  return scale;
}

function addSecondaryDominants(map, centerPc, scale) {
  for (let degreeIndex = 0; degreeIndex < scale.length; degreeIndex += 1) {
    const targetRootPc = scale[degreeIndex];
    const rootPc = mod12(targetRootPc + 7);
    addCandidate(map, makeCandidate({
      rootPc,
      templateId: "dominant7",
      pitchClasses: chordPcs(rootPc, "dominant7"),
      source: "secondary-dominant",
      explanation: `dominant-seventh candidate targeting system degree ${degreeIndex + 1}`,
      metadata: { targetRootPc, targetDegreeNumber: degreeIndex + 1 }
    }, centerPc));
  }
}

function parallelMixtureSystems(systemId) {
  if (systemId === "major") return ["natural-minor"];
  if (systemId === "natural-minor" || systemId === "harmonic-minor") return ["major"];
  return ["major", "natural-minor"];
}

function addModalMixture(map, centerPc, systemId) {
  for (const borrowedSystemId of parallelMixtureSystems(systemId)) {
    const borrowed = systemById(borrowedSystemId);
    const scale = borrowed.intervals.map((interval) => mod12(centerPc + interval));
    for (let degreeIndex = 0; degreeIndex < 7; degreeIndex += 1) {
      const chord = chordFromExactPcs(tertianSonority(scale, degreeIndex, 3));
      addCandidate(map, makeCandidate({
        ...chord,
        source: "modal-mixture",
        explanation: `parallel-${borrowed.name} triad on borrowed degree ${degreeIndex + 1}`,
        metadata: { borrowedSystemId, borrowedDegreeNumber: degreeIndex + 1 }
      }, centerPc));
    }
  }
}

function normalizeCurrentChord(currentChord) {
  if (currentChord == null) return null;
  if (!currentChord || typeof currentChord !== "object") throw new TypeError("currentChord must be an object");
  if (currentChord.rootPc != null && currentChord.templateId) {
    const rootPc = mod12(assertInteger(currentChord.rootPc, "currentChord.rootPc"));
    return { rootPc, templateId: currentChord.templateId, pitchClasses: chordPcs(rootPc, currentChord.templateId) };
  }
  const pcs = normalizePcs(currentChord.pitchClasses ?? currentChord.pcs, "currentChord.pitchClasses");
  if (!pcs.length) throw new TypeError("currentChord requires rootPc + templateId or pitchClasses");
  const match = chordFromExactPcs(pcs);
  return match;
}

function addChromaticMediants(map, centerPc, currentChord) {
  if (!currentChord?.rootPc && currentChord?.rootPc !== 0) return;
  for (const delta of [-4, -3, 3, 4]) {
    const rootPc = mod12(currentChord.rootPc + delta);
    for (const templateId of ["major", "minor"]) {
      addCandidate(map, makeCandidate({
        rootPc,
        templateId,
        pitchClasses: chordPcs(rootPc, templateId),
        source: "chromatic-mediant",
        explanation: `chromatic-mediant root displacement ${delta > 0 ? "+" : ""}${delta} semitones from the current root`,
        metadata: { fromRootPc: currentChord.rootPc, displacementSemitones: delta }
      }, centerPc));
    }
  }
}

function addHolographicShadowCandidates(map, centerPc, activeField, shadowField) {
  if (!activeField?.length || !shadowField?.length) return;
  const active = new Set(normalizePcs(activeField, "activeField"));
  const shadow = new Set(normalizePcs(shadowField, "shadowField"));
  for (let rootPc = 0; rootPc < 12; rootPc += 1) {
    for (const templateId of ["major", "minor", "sus2", "sus4", "dominant7", "minor7", "major7"]) {
      const pitchClasses = chordPcs(rootPc, templateId);
      const admitted = pitchClasses.filter((pc) => shadow.has(pc));
      const activeOverlap = pitchClasses.filter((pc) => active.has(pc));
      if (!admitted.length || activeOverlap.length < 2) continue;
      addCandidate(map, makeCandidate({
        rootPc,
        templateId,
        pitchClasses,
        source: "holographic-shadow",
        explanation: `candidate retains ${activeOverlap.length} active-field pitch classes while admitting ${admitted.length} shadow pitch class${admitted.length === 1 ? "" : "es"}`,
        metadata: { admittedShadowPitchClasses: admitted, activeOverlapPitchClasses: activeOverlap }
      }, centerPc));
    }
  }
}

function addExternalCandidates(map, centerPc, externalCandidates) {
  if (externalCandidates == null) return;
  if (!Array.isArray(externalCandidates)) throw new TypeError("externalCandidates must be an array");
  for (let index = 0; index < externalCandidates.length; index += 1) {
    const item = externalCandidates[index];
    if (!item || typeof item !== "object") throw new TypeError(`externalCandidates[${index}] must be an object`);
    const source = item.source ?? "external";
    if (!["corpus-observed", "user-style", "external"].includes(source)) {
      throw new RangeError(`Unsupported external candidate source: ${source}`);
    }
    let rootPc = item.rootPc == null ? null : mod12(assertInteger(item.rootPc, `externalCandidates[${index}].rootPc`));
    let templateId = item.templateId ?? null;
    let pitchClasses;
    if (rootPc != null && templateId) pitchClasses = chordPcs(rootPc, templateId);
    else pitchClasses = normalizePcs(item.pitchClasses ?? item.pcs, `externalCandidates[${index}].pitchClasses`);
    if (!pitchClasses.length) throw new RangeError(`externalCandidates[${index}] has no pitch classes`);
    addCandidate(map, makeCandidate({
      rootPc,
      templateId,
      pitchClasses,
      source,
      explanation: item.explanation ?? `candidate supplied by ${source} evidence`,
      metadata: { externalId: item.id ?? null, ...item.metadata }
    }, centerPc));
  }
}

function freezeCandidate(candidate) {
  const sourceRank = (source) => {
    const index = SOURCE_ORDER.indexOf(source);
    return index >= 0 ? index : SOURCE_ORDER.length;
  };
  candidate.sources.sort((a, b) => sourceRank(a) - sourceRank(b) || a.localeCompare(b));
  candidate.explanations.sort();
  return Object.freeze({
    ...candidate,
    pitchClasses: Object.freeze([...candidate.pitchClasses]),
    sources: Object.freeze([...candidate.sources]),
    explanations: Object.freeze([...candidate.explanations]),
    metadata: Object.freeze({ ...candidate.metadata })
  });
}

export function generateContinuationCandidates(context, options = {}) {
  if (!context || typeof context !== "object") throw new TypeError("context must be an object");
  const centerPc = mod12(assertInteger(context.centerPc, "context.centerPc"));
  const system = systemById(context.systemId ?? "major");
  const currentChord = normalizeCurrentChord(context.currentChord ?? null);
  const maxCandidates = Number(options.maxCandidates ?? 128);
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1) throw new RangeError("maxCandidates must be a positive integer");

  const enabled = {
    diatonic: options.diatonic !== false,
    secondaryDominants: options.secondaryDominants !== false,
    modalMixture: options.modalMixture !== false,
    chromaticMediants: options.chromaticMediants !== false,
    holographicShadow: options.holographicShadow !== false,
    external: options.external !== false
  };

  const map = new Map();
  let scale = system.intervals.map((interval) => mod12(centerPc + interval));
  if (enabled.diatonic) scale = addDiatonic(map, centerPc, system, options.includeSevenths !== false);
  if (enabled.secondaryDominants) addSecondaryDominants(map, centerPc, scale);
  if (enabled.modalMixture) addModalMixture(map, centerPc, system.id);
  if (enabled.chromaticMediants) addChromaticMediants(map, centerPc, currentChord);
  if (enabled.holographicShadow) addHolographicShadowCandidates(map, centerPc, context.activeField, context.shadowField);
  if (enabled.external) addExternalCandidates(map, centerPc, context.externalCandidates);

  const candidates = [...map.values()].map(freezeCandidate);
  const sourceRank = (candidate) => Math.min(...candidate.sources.map((source) => {
    const index = SOURCE_ORDER.indexOf(source);
    return index >= 0 ? index : SOURCE_ORDER.length;
  }));
  candidates.sort((a, b) =>
    sourceRank(a) - sourceRank(b) ||
    (a.rootPc ?? 99) - (b.rootPc ?? 99) ||
    String(a.templateId ?? "").localeCompare(String(b.templateId ?? "")) ||
    a.pitchClasses.join(".").localeCompare(b.pitchClasses.join("."))
  );

  const sliced = candidates.slice(0, maxCandidates);
  const sourceCounts = {};
  for (const candidate of sliced) {
    for (const source of candidate.sources) sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  }

  return Object.freeze({
    centerPc,
    systemId: system.id,
    systemName: system.name,
    currentChord: currentChord == null ? null : Object.freeze({ ...currentChord, pitchClasses: Object.freeze([...currentChord.pitchClasses]) }),
    candidates: Object.freeze(sliced),
    sourceCounts: Object.freeze(sourceCounts),
    truncated: candidates.length > maxCandidates,
    generatedCount: candidates.length,
    returnedCount: sliced.length,
    evidenceClass: "candidate-generation"
  });
}
