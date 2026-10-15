import { assertScoreHIR, HARMONIC_IR_VERSION, HARMONIC_IR_ANALYSIS_VERSION } from "../model/harmonic-ir.js";
import { copyAnalysis, freezeAnalysis, finiteAnalysisTree } from "../model/harmonic-state.js";
import { mod12 } from "../theory/pitch.js";
import { extractHarmonicFingerprintV1 } from "./extract.js";
import { extractModalProfile } from "./blocks/modal-profile.js";
import { extractChromaticStrategy } from "./blocks/chromatic-strategy.js";
import { FINGERPRINT_BLOCK_NAMES, FOUNDATION_IMPLEMENTED_BLOCKS } from "./schema.js";

// Experimental expansion; the original foundation and saved comparison schemas stay unchanged.
export const HIR_FINGERPRINT_SCHEMA_VERSION = "1.1.0-experimental";
export const HIR_FINGERPRINT_ANALYSIS_VERSION = "0.3.0-hir-nine-blocks";
export const HIR_IMPLEMENTED_BLOCKS = Object.freeze(FINGERPRINT_BLOCK_NAMES.filter(name =>
  FOUNDATION_IMPLEMENTED_BLOCKS.includes(name) || ["chordVocabulary", "chordTransitions", "rootMotion", "modalProfile", "chromaticStrategy"].includes(name)));

export function extractHarmonicFingerprintFromHIR(hir) {
  assertScoreHIR(hir);
  const center = hir.selectedReferenceCenter.pc;
  const foundation = extractHarmonicFingerprintV1(hir.events, { sourceId: hir.source.id, centerPc: center,
    referenceField: hir.referenceField, centerSource: hir.selectedReferenceCenter.source });
  const relativeEvents = hir.events.map(event => ({ ...event, pitchClass: mod12(event.pitchClass - center) }));
  const relativeField = hir.referenceField.map(pc => mod12(pc - center)).sort((a, b) => a - b);
  const modal = extractModalProfile([{ candidates: hir.harmonicObjects.contextualFunction.hypotheses }], { referenceCenterPc: 0 });
  const normalized = { ...foundation.normalized,
    chordVocabulary: hir.harmonicObjects.chordVocabulary,
    chordTransitions: hir.harmonicObjects.chordTransitions,
    rootMotion: hir.harmonicObjects.rootMotion,
    modalProfile: { ...modal, centerChangeRate: null, scope: "whole-score-hypothesis-summary; local trajectory pending" },
    chromaticStrategy: { ...extractChromaticStrategy(relativeEvents, { centerPc: 0, referenceField: relativeField }),
      centerChangePrecedenceRate: null, centerChangeEvidenceAvailable: false }
  };
  return freezeAnalysis({ ...foundation, schemaVersion: HIR_FINGERPRINT_SCHEMA_VERSION,
    analysisVersion: HIR_FINGERPRINT_ANALYSIS_VERSION, normalized,
    provenance: { ...foundation.provenance, hirSchemaVersion: HARMONIC_IR_VERSION, hirAnalysisVersion: HARMONIC_IR_ANALYSIS_VERSION,
      sourceFormat: hir.source.format, sourceSha256: hir.source.sha256, parserVersion: hir.source.parserVersion,
      transformations: copyAnalysis(hir.provenance.transformations), referenceFieldSource: hir.provenance.configuration.referenceField == null ? "inferred" : "supplied",
      coordinates: "Additional pitch-dependent blocks use pitch classes relative to the HIR normalization reference.",
      limitations: "Transitions and root motion use leading inferred candidates. Alternatives remain in HIR. Modal profile summarizes whole-score hypotheses, not a local trajectory. Seconds-based features are not tempo invariant." },
    capabilities: { implementedBlocks: [...HIR_IMPLEMENTED_BLOCKS], pendingBlocks: FINGERPRINT_BLOCK_NAMES.filter(name => !HIR_IMPLEMENTED_BLOCKS.includes(name)) },
    inferenceQuality: { ...foundation.inferenceQuality,
      centerInferredByEngine: hir.selectedReferenceCenter.source === "inferred-normalization-anchor",
      centerAmbiguous: hir.selectedReferenceCenter.ambiguous, weightsAreProbabilities: false,
      evidenceClassByBlock: { ...foundation.inferenceQuality.evidenceClassByBlock,
        chordVocabulary: "mixed-deterministic-and-inferred", chordTransitions: "deterministic-under-inferred-functions",
        rootMotion: "deterministic-under-inferred-roots", modalProfile: "inferred-whole-score-summary",
        chromaticStrategy: "deterministic-under-reference-field" } }
  });
}

export function validateHIRFingerprint(value) {
  return value?.schemaVersion === HIR_FINGERPRINT_SCHEMA_VERSION && value.analysisVersion === HIR_FINGERPRINT_ANALYSIS_VERSION &&
    typeof value.sourceId === "string" && !!value.sourceId && Number.isFinite(value.durationSec) && value.durationSec > 0 &&
    value.provenance?.hirSchemaVersion === HARMONIC_IR_VERSION && finiteAnalysisTree(value) &&
    JSON.stringify(value.capabilities?.implementedBlocks) === JSON.stringify(HIR_IMPLEMENTED_BLOCKS) &&
    FINGERPRINT_BLOCK_NAMES.every(name => HIR_IMPLEMENTED_BLOCKS.includes(name)
      ? value.normalized?.[name] != null && typeof value.normalized[name] === "object" : value.normalized?.[name] === null);
}

export function serializeHIRFingerprint(value) {
  if (!validateHIRFingerprint(value)) throw new TypeError("Invalid or incompatible expanded fingerprint");
  return JSON.stringify(value, null, 2);
}
