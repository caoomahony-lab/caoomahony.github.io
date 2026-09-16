import { mod12 } from "../theory/pitch.js";
import { extractPitchEcology } from "./blocks/pitch-ecology.js";
import { extractBassGravity } from "./blocks/bass-gravity.js";
import { extractIntervalSpectrum } from "./blocks/interval-spectrum.js";
import { extractRegisterTexture } from "./blocks/register-texture.js";
import {
  FINGERPRINT_BLOCK_NAMES,
  FOUNDATION_IMPLEMENTED_BLOCKS,
  HARMONIC_FINGERPRINT_ANALYSIS_VERSION,
  HARMONIC_FINGERPRINT_SCHEMA_VERSION
} from "./schema.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function withoutCenter(block) {
  const { centerPc: _centerPc, ...rest } = block;
  return rest;
}

function normalizedRegisterTexture(block) {
  return {
    totalPitchSpan: block.totalPitchSpan,
    meanBassTopSeparation: block.meanBassTopSeparation,
    simultaneityCardinality: block.simultaneityCardinality,
    meanSimultaneity: block.meanSimultaneity,
    attackDensityPerSecond: block.attackDensityPerSecond,
    spanSlopeSemitonesPerNormalizedTime: block.spanSlopeSemitonesPerNormalizedTime,
    expansionTransitionRate: block.expansionTransitionRate,
    contractionTransitionRate: block.contractionTransitionRate,
    sparseTextureShare: block.sparseTextureShare,
    denseTextureShare: block.denseTextureShare,
    registralClimaxPosition: block.registralClimaxPosition,
    bassTopIndependenceRate: block.bassTopIndependenceRate,
    soundingDurationSec: block.soundingDurationSec,
    segmentCount: block.segmentCount
  };
}

export function extractHarmonicFingerprintV1(events, {
  sourceId,
  centerPc,
  referenceField = null,
  centerSource = "declared"
} = {}) {
  if (!Array.isArray(events)) throw new TypeError("events must be an array");
  const id = String(sourceId || "").trim();
  if (!id) throw new TypeError("sourceId is required");
  if (!Number.isFinite(Number(centerPc))) throw new TypeError("centerPc is required for foundation fingerprint extraction");
  const center = mod12(centerPc);
  const durationSec = events.reduce((max, event) => Math.max(max, Number(event.endSec) || 0), 0);

  const pitchEcology = extractPitchEcology(events, { centerPc: center, referenceField });
  const bassGravity = extractBassGravity(events, { centerPc: center, referenceField });
  const intervalSpectrum = extractIntervalSpectrum(events);
  const registerTextureFull = extractRegisterTexture(events);
  const normalized = Object.fromEntries(FINGERPRINT_BLOCK_NAMES.map((name) => [name, null]));
  normalized.pitchEcology = withoutCenter(pitchEcology);
  normalized.bassGravity = withoutCenter(bassGravity);
  normalized.intervalSpectrum = intervalSpectrum;
  normalized.registerTexture = normalizedRegisterTexture(registerTextureFull);

  const pendingBlocks = FINGERPRINT_BLOCK_NAMES.filter((name) => !FOUNDATION_IMPLEMENTED_BLOCKS.includes(name));
  const fingerprint = {
    schemaVersion: HARMONIC_FINGERPRINT_SCHEMA_VERSION,
    analysisVersion: HARMONIC_FINGERPRINT_ANALYSIS_VERSION,
    sourceId: id,
    durationSec,
    provenance: {
      eventSchemaVersion: events[0]?.schemaVersion ?? null,
      eventCount: events.length,
      centerSource,
      referenceFieldProvided: referenceField != null
    },
    absolute: {
      centerPc: center,
      referenceField: referenceField == null ? null : [...referenceField].map(mod12).sort((a, b) => a - b),
      register: {
        minMidi: registerTextureFull.minMidi,
        maxMidi: registerTextureFull.maxMidi,
        medianMidi: registerTextureFull.medianMidi,
        durationWeightedMedianMidi: registerTextureFull.durationWeightedMedianMidi,
        meanBassMidi: registerTextureFull.meanBassMidi,
        meanTopMidi: registerTextureFull.meanTopMidi
      }
    },
    normalized,
    capabilities: {
      implementedBlocks: [...FOUNDATION_IMPLEMENTED_BLOCKS],
      pendingBlocks
    },
    inferenceQuality: {
      centerSource,
      centerInferredByEngine: false,
      evidenceClassByBlock: {
        pitchEcology: "deterministic",
        bassGravity: "deterministic",
        intervalSpectrum: "deterministic",
        registerTexture: "deterministic"
      }
    }
  };
  return deepFreeze(fingerprint);
}
