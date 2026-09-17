import test from "node:test";
import assert from "node:assert/strict";
import { buildContinuationSession } from "../src/continuation/session.js";

test("declared context analyzes a progression and translates the same functions to a target key", () => {
  const session = buildContinuationSession({
    progression: "C | Am | F | G",
    contextTonic: "C",
    systemId: "major",
    targetTonic: "F#",
    candidateOptions: { maxCandidates: 12, holographicShadow: false }
  });
  assert.equal(session.context.source, "declared");
  assert.equal(session.context.centerPc, 0);
  assert.equal(session.context.systemId, "major");
  assert.deepEqual(session.progression.map((row) => row.function.roman), ["I", "vi", "IV", "V"]);
  assert.deepEqual(session.progression.map((row) => row.function.targetKeyChord), ["F#", "D#m", "B", "C#"]);
  assert.ok(session.progression.every((row) => row.function.beginner.length > 0));
});

test("empty context tonic preserves inference and competing context hypotheses", () => {
  const session = buildContinuationSession({
    progression: "C | Am | F | G",
    contextTonic: "",
    candidateOptions: { maxCandidates: 8, holographicShadow: false }
  });
  assert.equal(session.context.source, "inferred");
  assert.ok(session.context.hypotheses.length > 1);
  assert.ok(session.notes[0].includes("inference"));
});

test("inferred continuation rows stay aligned to the selected syntax-aware context", () => {
  const session = buildContinuationSession({
    progression: "Cmaj7 | E7/G# | Am9 | Fmaj7",
    contextTonic: "",
    candidateOptions: { maxCandidates: 8, holographicShadow: false }
  });
  assert.ok([0,9].includes(session.context.centerPc), `expected C- or A-centered context, got ${session.context.centerPc} ${session.context.systemId}`);
  const selected = session.context.hypotheses[0];
  assert.ok(selected.syntaxSupport > 0);
  assert.deepEqual(
    session.progression.map((row) => row.function?.roman ?? null),
    selected.functions.map((entry) => entry.candidates[0]?.roman ?? null)
  );
});

test("session does not create a composite ranking unless explicitly requested", () => {
  const session = buildContinuationSession({
    progression: "C | Am | F | G",
    contextTonic: "C",
    systemId: "major",
    candidateOptions: { maxCandidates: 8, holographicShadow: false }
  });
  assert.equal(session.ranking, null);
  assert.ok(session.candidates.length > 0);
  assert.ok(session.notes[1].includes("No composite"));
});

test("explicit ranking config flows through HHF-019/020/021", () => {
  const session = buildContinuationSession({
    progression: "C | Am | F | G",
    contextTonic: "C",
    systemId: "major",
    ranking: {
      weights: { functional: 2, novelty: 1 },
      missingPolicy: "renormalize",
      limit: 6
    },
    candidateOptions: { maxCandidates: 12, holographicShadow: false }
  });
  assert.ok(session.ranking);
  assert.equal(session.ranking.returnedCount, 6);
  assert.deepEqual(session.ranking.requestedWeights.functional, 2);
  assert.ok(session.ranking.rankings.every((entry) => entry.note.includes("not probability")));
});

test("registered current voicing activates concrete voice-leading continuation evidence", () => {
  const session = buildContinuationSession({
    progression: "C | Am | F | G",
    currentVoicing: "G2 D3 G3 B3",
    contextTonic: "C",
    systemId: "major",
    candidateOptions: { maxCandidates: 8, holographicShadow: false },
    scoringOptions: { voiceLeading: { maxVoicingCandidates: 100 } }
  });
  assert.ok(session.candidates.some((entry) => entry.dimensions.voiceLeading.available));
  const available = session.candidates.find((entry) => entry.dimensions.voiceLeading.available);
  assert.ok(available.dimensions.voiceLeading.bestVoicing.length === 4);
});

test("Holographic fields flow into candidate generation and scoring without becoming required", () => {
  const session = buildContinuationSession({
    progression: "B | F#",
    contextTonic: "B",
    systemId: "lydian",
    activeField: [11, 1, 3, 5, 6, 8, 10],
    shadowField: [0, 2, 4, 7, 9],
    candidateOptions: { maxCandidates: 24 }
  });
  assert.ok(session.generation.sourceCounts["holographic-shadow"] > 0);
  assert.ok(session.candidates.some((entry) => entry.dimensions.holographicContinuity.available));
});

test("candidate presentations expose Roman/Nashville/target-key/beginner views where defined", () => {
  const session = buildContinuationSession({
    progression: "C | F | G",
    contextTonic: "C",
    systemId: "major",
    targetTonic: "Bb",
    candidateOptions: { maxCandidates: 10, holographicShadow: false }
  });
  const harmonicCandidate = session.candidates.find((entry) => entry.candidate.rootPc != null && entry.candidate.templateId);
  assert.ok(harmonicCandidate.presentation.roman);
  assert.ok(harmonicCandidate.presentation.nashville);
  assert.ok(harmonicCandidate.presentation.targetKeyChord);
  assert.ok(harmonicCandidate.presentation.beginner);
});

test("invalid target keys and explicit systems fail closed", () => {
  assert.throws(() => buildContinuationSession({
    progression: "C | G",
    contextTonic: "C",
    systemId: "not-a-system"
  }), /Unknown systemId/);
  assert.throws(() => buildContinuationSession({
    progression: "C | G",
    contextTonic: "C",
    systemId: "major",
    targetTonic: "H"
  }), /Unsupported tonic spelling|unsupported tonic spelling/);
});
