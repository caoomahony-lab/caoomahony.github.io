import { validateNoteEventV1 } from "../model/events.js";
import { inferScoreHarmony, SCORE_HARMONY_VERSION } from "../inference/score-harmony.js";
import {
  deriveEvidenceAwareDescriptor, compareEvidenceAwareDescriptors, orderedHarmonyDistance
} from "../similarity/evidence-aware-distance.js";

export const SCORE_SIMILARITY_AUDIT_VERSION = "score-similarity-audit-v1";
const mod12 = (value) => ((value % 12) + 12) % 12;

// Reuse the order metric with a measured bass anchor and a relative pitch-set
// identity. The rootPc field here is an anchor, never an inferred chord root.
function measuredToken(region) {
  return Object.freeze({
    rootPc: region.bassPc,
    family: region.measuredPitchClasses.map((pc) => mod12(pc - region.bassPc))
      .sort((a, b) => a - b).join(",")
  });
}

export function deriveScoreSimilarityAudit(events, { sourceId } = {}) {
  if (!Array.isArray(events)) throw new TypeError("events must be a canonical NoteEventV1 array");
  if (events.some((event) => !validateNoteEventV1(event) || event.pitchClass !== mod12(event.midi))) {
    throw new TypeError("Every score event must be valid NoteEventV1 with consistent MIDI/pitch class");
  }
  if (typeof sourceId !== "string" || !sourceId.trim()) throw new TypeError("sourceId is required");
  const registeredNoteEvents = events.map((event) => ({
    midi: event.midi, onset: event.onsetSec, duration: event.durationSec
  }));
  const overallChroma = Array(12).fill(0);
  for (const event of events) overallChroma[event.pitchClass] += event.durationSec;
  const harmony = inferScoreHarmony(events);
  const descriptor = deriveEvidenceAwareDescriptor({
    analysis: { registeredNoteEvents, overallChroma }, harmony
    // No audio-only descriptive profile is fabricated for symbolic input.
  });
  const auditDescriptor = Object.freeze({
    ...descriptor,
    evidenceClass: "measured-score-notes-with-inferred-chords",
    summary: Object.freeze({ ...descriptor.summary, evidenceClass: "measured-score-notes-with-inferred-chords" }),
    assumptions: Object.freeze({
      ...descriptor.assumptions,
      topLine: "highest score note within 0.09 seconds; not verified melody",
      order: "inferred root/chord-family sequence; not verified functional interpretation"
    })
  });
  const tied = harmony.regions.filter((region) => region.candidates.length > 1 &&
    Math.abs(region.candidates[0].support - region.candidates[1].support) < 1e-12).length;
  return Object.freeze({
    version: SCORE_SIMILARITY_AUDIT_VERSION,
    sourceId,
    provenance: Object.freeze({
      eventSchemaVersion: events[0]?.schemaVersion ?? null,
      formats: Object.freeze([...new Set(events.map((event) => event.source))].sort()),
      scoreHarmonyVersion: SCORE_HARMONY_VERSION
    }),
    counts: Object.freeze({ notes: events.length, sonorityRegions: harmony.regions.length, tiedTopChordLabels: tied }),
    durationSeconds: events.reduce((end, event) => Math.max(end, event.endSec), 0),
    auditDescriptor,
    measuredSequence: Object.freeze(harmony.regions.map(measuredToken)),
    note: "Score pitches, timing and sounding bass are measured. Chord labels are inferred. Measured order ignores octave, voice assignment, timing gaps and rhythm."
  });
}

export function compareScoreSimilarityAudits(a, b, { passageRegionLimit = 64 } = {}) {
  if (a?.version !== SCORE_SIMILARITY_AUDIT_VERSION || b?.version !== SCORE_SIMILARITY_AUDIT_VERSION) {
    throw new TypeError("Matching score-similarity audit versions are required");
  }
  if (!Number.isInteger(passageRegionLimit) || passageRegionLimit < 1 || passageRegionLimit > 256) {
    throw new RangeError("passageRegionLimit must be an integer in 1..256");
  }
  const summary = compareEvidenceAwareDescriptors(a.auditDescriptor, b.auditDescriptor);
  const measuredOrder = orderedHarmonyDistance(a.measuredSequence, b.measuredSequence);
  const openingMeasuredOrder = orderedHarmonyDistance(
    a.measuredSequence.slice(0, passageRegionLimit), b.measuredSequence.slice(0, passageRegionLimit)
  );
  const openingChordOrder = orderedHarmonyDistance(
    a.auditDescriptor.sequence?.slice(0, passageRegionLimit),
    b.auditDescriptor.sequence?.slice(0, passageRegionLimit)
  );
  return Object.freeze({
    version: SCORE_SIMILARITY_AUDIT_VERSION,
    sourceA: a.sourceId, sourceB: b.sourceId,
    summary,
    measuredOrder: Object.freeze({
      ...measuredOrder, evidenceClass: "measured-score-sonorities",
      definition: "ordered pitch-class sets and bass pitch class under one global transposition"
    }),
    openingPassage: Object.freeze({
      selection: "first sounding sonority regions of each score", regionLimit: passageRegionLimit,
      measuredOrder: openingMeasuredOrder, inferredChordOrder: openingChordOrder,
      note: "A separate opening-passage result; not a truncated whole-piece distance or a matched musical phrase."
    })
  });
}
