# HHF-3.9.3 — Measured score comparison in the app

Branch: `harmonic-savant-hhf3.9.3-score-compare`

Starting source: `9456f2a47f1231634d768606bbd3af569faaed3a`
Scope: finish the current symbolic comparison checkpoint, primarily HHF-029/031/032/033/034; retain experimental status and compare the full project with the master plan.

## Delivered route

MusicXML, MXL and MIDI produce canonical `NoteEventV1` events through the existing parsers. Successful local loads and bundled demos publish these events to the score comparison panel. A module worker derives and compares fingerprints without executing the heavy analysis on the UI thread. Source switches cancel pending work and stale replies cannot replace the current piece.

The panel saves local score records by SHA-256 source identity, compares them with any selected saved score, ranks by an explicit component, provides all eight component distances and one declared global transposition, displays a pitch-content overlay, and exports fingerprints/comparisons as versioned JSON. Same-title files with different source bytes remain distinct. Failed storage writes are exposed and never labeled successful.

The existing audio fingerprint library and original/evidence-aware summary methods remain available for audio input. The new route does not silently change their formulas or saved versions. No aggregate similarity percentage is added.

## Definitions and invariants

Engine: `score-comparison-v1`. The existing four-block foundation fingerprint is reused with pitch-class origin 0 for rotation matching, explicitly not a tonic estimate. Its pending full-fingerprint blocks remain pending.

Distances:

- full sonority order: normalized edit count of measured pitch-class sets and sounding bass;
- pitch content and bass: total variation of normalized duration-weighted distributions;
- vertical interval spectrum: total variation of the existing canonical interval-class distribution;
- upper-note intervals: signed MIDI interval histogram of the highest attacked note at exact score attacks, not verified melody;
- attack rhythm: quarter-log2 bins of successive attack-gap ratios, using score quarter-beats when present;
- sonority durations: quarter-log2 bins of durations relative to their median;
- chord-candidate order: complete tied best-support candidate cohorts relative to measured bass, preserving ambiguity.

All pitch-dependent components share the global shift chosen by the ranking metric. There is no hidden blend. Exact source attacks replace the old audio-derived 90ms grouping in this new score route. The full candidate universe is evaluated before selecting a tied cohort, avoiding transposition-dependent top-N truncation and arbitrary absolute-root winners.

Edit distance reuses the existing algorithm with typed rows. The new score route explicitly allows 48 million updates for whole-order matching; the old method retains its three-million limit. A separately labeled first-64-region opening is never substituted for an unavailable whole-piece result. Very long pairs remain explicitly bounded.

## Verification

Six private score files representing four works and two revisions were tested with self, +5-semitone and duration ×2 transformations. Every available component passes within 1e-12 for all six control groups; all 15 whole-piece pair calculations complete. Files remain unchanged. The slowest measured pair calculation was about 382ms in this runtime; derivation of the largest score was about 4.2 seconds and runs in the browser worker.

Synthetic tests cover all 12 transpositions, tied C6/Am7 interpretations, fast attacks, identical inventories with changed order, changed bass, changed rhythmic proportions, missing evidence, computation limits, invalid stored records, non-destructive extraction, canonical source routing, stale source changes, local-storage failures and same-title source identity. The batch CLI also refuses to overwrite inputs. Full suite: **236 passed, 0 failed**; `npm ci`, build and `git diff --check` passed.

Run:

```bash
npm ci
npm test
npm run build
node scripts/validate-score-comparison.mjs --json /private/report.json --markdown /private/report.md /private/score.musicxml [...]
```

Browser/deployment evidence and the 60-ticket master-plan audit are recorded in the accompanying completion report. Private scores and per-piece reports are kept out of Git. The broader roadmap is not complete: full HIR/fingerprint integration, temporal/Holographic blocks, passage indexing, aggregates, external corpus and empirical semantics remain separate gates.

## Migration and rollback

The new library uses `harmonic-savant:score-library:v1` and rejects incompatible/corrupt records; existing audio records use their existing key. Changed future score semantics require a new version and re-analysis. JSON export is the portable backup route; current files are never rewritten.

Rollback can serve the prior Vercel preview for `9456f2a` or check out that commit. The score panel, worker and new events are additive. The old validation CLI and audio formulas remain intact. This is an experimental deployment, not a replacement claim or a v1.0 release.
