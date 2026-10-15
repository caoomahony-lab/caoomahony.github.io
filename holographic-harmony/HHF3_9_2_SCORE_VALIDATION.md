# HHF-3.9.2 — Symbolic score similarity validation

Branch: `harmonic-savant-hhf3.9.2-score-validation`

Starting source: `80152441839243be0261c331f1cf71aeac811479`

Status: **Additive validation checkpoint; existing similarity is still experimental**

## Scope

The prior audit exposed missing-evidence and chord-order problems using deterministic examples. This checkpoint adds a reusable validation route from canonical MusicXML score events, so failures in comparison can be distinguished from failures in audio transcription. Private score files and their generated per-piece reports remain outside this repository.

The HHF-3.9 pairwise engine and HHF-3.9.1 evidence-aware engine are unchanged. No new similarity weight, corpus percentile, automatic ranking or production replacement is introduced.

## Added route

`src/validation/score-similarity-audit.js` consumes validated `NoteEventV1` events. It derives duration-weighted chroma and score sonorities through the existing parser and `inferScoreHarmony`. The original and audited summaries are reported with score provenance. The six-dimension audio-only descriptive profile is unavailable, rather than fabricated; the evaluated real files have seven available summary components.

The additional measured-order diagnostic compares the ordered **pitch-class set and lowest sounding pitch class** for each sonority. Each token uses the bass as an anchor and retains the full set relative to it. The existing global-transposition edit-distance implementation is reused without changing it. The `rootPc` field in these internal measured tokens represents that bass anchor, not an inferred root.

This is a deterministic, narrow feature. It ignores register, voice assignment, rests and rhythm, and it is not an overall similarity verdict. Unknown/missing evidence and the existing three-million-cell calculation limit stay explicit.

Long pairs also receive a separately labeled opening comparison over at most 64 sounding sonority regions per file. This is an opening scope, not a truncated whole-piece estimate, matched phrase, or substitute for unavailable whole-piece order.

## Reproducible command

```bash
node scripts/audit-score-similarity.mjs \
  --json /absolute/private/output/report.json \
  --markdown /absolute/private/output/report.md \
  /absolute/private/input/first.musicxml \
  /absolute/private/input/second.musicxml
```

Outputs record source SHA-256, parser/event provenance, note/sonority counts, per-component distances, evidence coverage, transposition, edit counts and calculation-limit reasons. Input files are read only; the command refuses an output path identical to an input path. No score bytes or note sequences are exported in these reports.

## Real-score results

Six local score files representing four compositions and two related revisions were evaluated, producing 15 pair comparisons. Every score was also analyzed against itself, a copy transposed five semitones, a copy with all durations/onsets multiplied by two, and a reversal of its extracted opening sonorities. The reversal operates on diagnostic tokens after extraction; it does not edit a score file.

- All six self comparisons have zero summary and measured-order distance.
- All six transposition and duration-scale controls have zero measured-order distance, including long exact copies handled by the linear equality check.
- Reversed opening measured-order distances range from 0.8750 to 0.9688.
- An expression-only revision has identical measured sequence and summaries. Its ending revision adds one sonority and has measured whole-piece order distance `1/328 ≈ 0.00305`.
- Distinct compositions have audited summary distances approximately `0.2014–0.3328`, while their opening measured-order distances range from `0.8750–0.9531`. These scopes and definitions differ; the values are not listener-calibrated similarity percentages.

The validation also confirms two unresolved limitations in the existing summary:

1. **Absolute-root tie breaking changes inferred chord labels under transposition.** All six real-score summaries change slightly (`~0.0003–0.0010`). Among the four files whose full inferred-order calculation fits the budget, chord order also changes (`~0.0061–0.0068`). The remaining two full order results are unavailable above the computation limit, not counted as failed order tests. A small C6/Am7 regression reproduces the root-label problem directly.
2. **The fixed 0.09-second top-note grouping is not globally tempo invariant.** Two of the six duration-scaled score summaries change by approximately `0.0201` and `0.0209`. The measured sonority sequences remain identical. Exact score attack/beat coordinates should be evaluated separately before replacing this audio-derived grouping rule.

A summary score can therefore agree closely while musical ordering differs, and it can change slightly when the same music is transposed or globally slowed. The existing metric has not passed the constitution's replacement gate.

## Verification and browser limit

Eleven new regression tests cover symbolic provenance, measured set/bass preservation, transposition, changed bass, reordered passages, tied chord interpretations, scoped computation limits, invalid and absent input, determinism, source immutability, end-to-end command output, and input-overwrite refusal.

Full suite: **218 passed, 0 failed**. `npm run build`, JavaScript syntax checks,
and `git diff --check` passed. The six-file audit completed with no measured-order
control failures. The command distinguishes failed inferred-order invariance
from unavailable results above the calculation budget.

The existing Vercel preview for `8015244` opened in a native browser and its original/experimental selector changed successfully. No application-origin console errors were observed during that limited check. The audio file chooser/upload then stalled and was aborted. Audio decoding, complete upload acceptance, and phone layout remain unverified; this checkpoint does not claim to have completed those checks or deployed a production change.

## Next bounded gate

Keep the scored measurements and inferred labels separate. Evaluate a versioned score-specific attack/rhythm representation using exact score coordinates, and an ambiguity-aware chord representation that survives global transposition. Require these controlled real-score transformations to pass before proposing new aggregate weights or treating neighbor rankings as calibrated musical similarity. Private user sources must remain local.
