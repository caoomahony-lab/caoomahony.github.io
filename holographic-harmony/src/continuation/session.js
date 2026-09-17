import { parseContinuationInput } from "../input/chord-sequence.js";
import { parseSpelledPitchClass, renderFunction, chordSymbolInTargetKey, beginnerFunctionDescription, degreeDescriptor } from "../theory/functions.js";
import { rankChordCandidates } from "../theory/chords.js";
import { mod12, pitchClassName } from "../theory/pitch.js";
import { interpretChordSequence, interpretChordUnderSystem } from "../inference/function-engine.js";
import { SCALE_SYSTEMS } from "../inference/scales.js";
import { generateContinuationCandidates } from "./candidate-generator.js";
import { scoreContinuationCandidates } from "./score-candidate.js";
import { rankContinuationCandidates } from "./rank.js";

function systemById(systemId) {
  const system = SCALE_SYSTEMS.find((item) => item.id === systemId);
  if (!system) throw new RangeError(`Unknown systemId: ${systemId}`);
  return system;
}

function explicitInterpretation(sequence, centerPc, systemId) {
  const system = systemById(systemId);
  const chords = sequence.chords.map((chord) => {
    const candidates = rankChordCandidates(chord.pitchClasses, {
      bassPc: chord.bassPc,
      limit: 6,
      minSupport: 0.20
    }).map((candidate) => interpretChordUnderSystem(candidate, {
      centerPc,
      systemId,
      systemSupport: 0.75
    })).sort((a, b) => b.support - a.support);
    return Object.freeze({ index: chord.index, pitchClasses: chord.pitchClasses, candidates: Object.freeze(candidates) });
  });
  const meanFunctionSupport = chords.length
    ? chords.reduce((sum, chord) => sum + (chord.candidates[0]?.support ?? 0), 0) / chords.length
    : 0;
  const hypothesis = Object.freeze({
    centerPc,
    systemId,
    systemName: system.name,
    support: meanFunctionSupport,
    relativeWeight: 1,
    contextSource: "declared",
    functions: Object.freeze(chords.map((chord) => Object.freeze({ index: chord.index, candidates: chord.candidates })))
  });
  return Object.freeze({
    hypotheses: Object.freeze([hypothesis]),
    chords: Object.freeze(chords),
    evidenceClass: "declared-context-plus-inference"
  });
}

function selectContext(sequence, { contextTonic = "", systemId = "major" } = {}) {
  const tonicText = String(contextTonic ?? "").trim();
  if (tonicText) {
    const tonic = parseSpelledPitchClass(tonicText);
    const interpretation = explicitInterpretation(sequence, tonic.pitchClass, systemId);
    return Object.freeze({
      centerPc: tonic.pitchClass,
      centerName: tonicText,
      systemId,
      systemName: systemById(systemId).name,
      contextSource: "declared",
      interpretation
    });
  }

  const interpretation = interpretChordSequence(sequence.analysisSequence, {
    hypothesisLimit: 8,
    chordCandidateLimit: 6,
    functionCandidateLimit: 6
  });
  const top = interpretation.hypotheses[0];
  if (!top) throw new Error("no tonal context hypothesis could be inferred");
  return Object.freeze({
    centerPc: top.centerPc,
    centerName: pitchClassName(top.centerPc),
    systemId: top.systemId,
    systemName: top.systemName,
    contextSource: "inferred",
    interpretation
  });
}

function progressionRows(sequence, context, targetTonic) {
  return Object.freeze(sequence.chords.map((sourceChord, index) => {
    const interpreted = context.interpretation.chords[index];
    const best = interpreted?.candidates?.[0] ?? null;
    return Object.freeze({
      index,
      sourceSymbol: sourceChord.sourceSymbol,
      rootSpelling: sourceChord.rootSpelling,
      slashBass: sourceChord.bassSpelling,
      pitchClasses: sourceChord.pitchClasses,
      function: best == null ? null : Object.freeze({
        roman: best.roman,
        nashville: best.nashville,
        role: best.role,
        support: best.support,
        degreeLabel: best.degreeLabel,
        beginner: renderFunction(best, { format: "beginner" }),
        targetKeyChord: targetTonic ? renderFunction(best, { format: "key", targetTonic }) : null,
        evidenceClass: best.evidenceClass
      })
    });
  }));
}

function candidatePresentation(scored, centerPc, targetTonic) {
  const candidate = scored.candidate;
  const functional = scored.dimensions.functional;
  const relativeSemitones = candidate.rootPc == null ? null : mod12(candidate.rootPc - centerPc);
  let targetKeyChord = null;
  let beginner = null;
  if (candidate.rootPc != null && candidate.templateId) {
    if (targetTonic) targetKeyChord = chordSymbolInTargetKey({ relativeSemitones, templateId: candidate.templateId }, targetTonic);
    if (functional.available) {
      beginner = beginnerFunctionDescription({
        role: functional.role,
        relativeSemitones,
        degreeLabel: degreeDescriptor(relativeSemitones).label
      });
    }
  }
  return Object.freeze({
    symbol: candidate.symbol,
    roman: candidate.roman,
    nashville: candidate.nashville,
    targetKeyChord,
    beginner,
    sources: candidate.sources,
    explanations: candidate.explanations
  });
}

export function buildContinuationSession({
  progression,
  currentVoicing = "",
  contextTonic = "",
  systemId = "major",
  targetTonic = "",
  activeField = null,
  shadowField = null,
  externalCandidates = null,
  corpusEvidence = null,
  styleEvidence = null,
  ranking = null,
  candidateOptions = {},
  scoringOptions = {}
} = {}) {
  const parsed = parseContinuationInput({ progression, currentVoicing });
  const context = selectContext(parsed.sequence, { contextTonic, systemId });
  const target = String(targetTonic ?? "").trim();
  if (target) parseSpelledPitchClass(target);

  const rows = progressionRows(parsed.sequence, context, target || null);
  const lastFunction = rows[rows.length - 1]?.function;
  const generated = generateContinuationCandidates({
    centerPc: context.centerPc,
    systemId: context.systemId,
    currentChord: parsed.sequence.currentChord,
    activeField,
    shadowField,
    externalCandidates
  }, candidateOptions);

  const scoreContext = {
    centerPc: context.centerPc,
    systemId: context.systemId,
    currentFunctionRole: lastFunction?.role ?? "ambiguous",
    currentVoicing: parsed.currentVoicing.length ? parsed.currentVoicing : undefined,
    recentChords: parsed.sequence.chords.map((chord) => chord.pitchClasses),
    activeField,
    shadowField,
    corpusEvidence,
    styleEvidence
  };
  const scored = scoreContinuationCandidates(generated.candidates, scoreContext, scoringOptions);
  const presented = Object.freeze(scored.map((entry) => Object.freeze({
    ...entry,
    presentation: candidatePresentation(entry, context.centerPc, target || null)
  })));

  let ranked = null;
  if (ranking != null) {
    ranked = rankContinuationCandidates(scored, ranking);
  }

  return Object.freeze({
    input: Object.freeze({
      progression: parsed.sequence.source,
      currentVoicing: parsed.currentVoicing,
      contextTonic: contextTonic || null,
      requestedSystemId: systemId,
      targetTonic: target || null
    }),
    context: Object.freeze({
      centerPc: context.centerPc,
      centerName: context.centerName,
      systemId: context.systemId,
      systemName: context.systemName,
      source: context.contextSource,
      hypotheses: context.interpretation.hypotheses
    }),
    progression: rows,
    candidates: presented,
    generation: generated,
    ranking: ranked,
    evidenceClass: "mixed",
    notes: Object.freeze([
      context.contextSource === "inferred" ? "Tonal context is an inference, not a measured fact." : "Tonal context was supplied by the user.",
      ranking == null ? "No composite continuation ranking was requested." : "Composite ranking follows explicit weights/preset and missing-data policy; it is not probability."
    ])
  });
}
