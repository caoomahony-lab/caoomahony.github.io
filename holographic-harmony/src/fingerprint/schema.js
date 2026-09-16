export const HARMONIC_FINGERPRINT_SCHEMA_VERSION = "1.0.0";
export const HARMONIC_FINGERPRINT_ANALYSIS_VERSION = "0.2.0-foundation";

export const FINGERPRINT_BLOCK_NAMES = Object.freeze([
  "pitchEcology",
  "bassGravity",
  "intervalSpectrum",
  "chordVocabulary",
  "chordTransitions",
  "rootMotion",
  "voiceLeading",
  "modalProfile",
  "chromaticStrategy",
  "registerTexture",
  "temporalArchitecture",
  "recurrence",
  "holographic"
]);

export const FOUNDATION_IMPLEMENTED_BLOCKS = Object.freeze([
  "pitchEcology",
  "bassGravity",
  "intervalSpectrum",
  "registerTexture"
]);

export function validateHarmonicFingerprintV1(fingerprint) {
  if (!fingerprint || typeof fingerprint !== "object") return false;
  if (fingerprint.schemaVersion !== HARMONIC_FINGERPRINT_SCHEMA_VERSION) return false;
  if (typeof fingerprint.analysisVersion !== "string" || !fingerprint.analysisVersion) return false;
  if (typeof fingerprint.sourceId !== "string" || !fingerprint.sourceId) return false;
  if (!Number.isFinite(fingerprint.durationSec) || fingerprint.durationSec < 0) return false;
  if (!fingerprint.absolute || typeof fingerprint.absolute !== "object") return false;
  if (!fingerprint.normalized || typeof fingerprint.normalized !== "object") return false;
  for (const block of FINGERPRINT_BLOCK_NAMES) {
    if (!(block in fingerprint.normalized)) return false;
  }
  if (!fingerprint.capabilities || !Array.isArray(fingerprint.capabilities.implementedBlocks)) return false;
  return true;
}
