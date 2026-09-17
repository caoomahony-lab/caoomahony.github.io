# HHF-3.4 WORK ORDER — Score-Calibrated Harmonic Regions

Repository: `caoomahony-lab/caoomahony.github.io`

Work branch: `harmonic-savant-hhf3.4-score-calibration`

Start implementation from parent checkpoint: `918c0d0152c1ef7d72ba8c0ce94b99c6e664e9ca`

Project root: `holographic-harmony/`

## Mission

Use the remaining Work allowance to push Harmonic Savant from **micro audio chord guesses** toward a **musically meaningful harmonic-region timeline**, while preserving every existing HHF-3.3 inference and the project's evidence boundaries.

The immediate product problem is visible in the current phone build: Springtime Ständchen produces about 104 inferred audio harmonic segments. HHF-3.3 correctly established the pipeline

`audio frame -> chord evidence -> stable micro-segment -> functional interpretation`

but that layer is still too granular to act as the final harmonic map. The next layer must consolidate compatible micro-segments into larger harmonic regions and create a score-derived reference path so audio inference can be validated rather than merely eyeballed.

The validation principle is:

`measured MusicXML score -> score sonority/reference regions`

compared against

`audio chroma -> preserved micro-segments -> inferred harmonic regions`

Do **not** train the audio result to simply copy the score. The score is an independent reference for testing and calibration.

## Non-negotiable project constraints

1. Preserve `ENGINEERING_DOCTRINE.md`, `PROJECT_CONSTITUTION.md`, `PLATFORM_STRATEGY.md`, `HARMONIC_SAVANT_MASTER_PLAN.md`, and all accepted HHF checkpoints.
2. No merge to `main`.
3. Do not delete or replace the HHF-3.3 micro-segment layer. Add a coarser region layer above it.
4. Keep evidence classes explicit: measured score facts vs inferred audio evidence vs tonal interpretation.
5. Do not invent bass evidence from chroma. HHF-3.3 correctly reports bass as unavailable from chroma-v1.
6. Relative weights are not calibrated probabilities. Keep that language.
7. Do not commit, upload, or publish the user's private compositions. `Springtime_Stanchen.musicxml` exists in the user's ChatGPT Library and is for local validation only. The corresponding MP3 was opened locally in the browser and likewise must not be added to GitHub.
8. Do not weaken tests to make implementation pass.
9. Do not redesign the whole UI. This is a scientific/analysis implementation with only the UI needed to expose the new layer.
10. Do not spend the Work window rediscovering architecture. Inspect the named files below and implement.

## Existing implementation to build on

Key files at the starting checkpoint:

- `src/inference/audio-harmony.js`
  - `AUDIO_HARMONY_VERSION = "audio-harmony-v1"`
  - frame chord candidates
  - Viterbi temporal path
  - short-run suppression
  - micro harmonic segments
  - ambiguity / alternatives
  - `analyzeHarmonicObjectSequence(...)` on micro-segments
- `src/app/collection-aware-app.js`
  - local audio analysis
  - audio harmonic timeline
  - playback-synchronized current inferred chord/function
  - current collection/center separation
- `src/music/musicxml.js`
  - parses measured note events with onset/duration/MIDI/pitch class/spelling/voice/staff/ties
  - already exposes enough information to build a score reference without changing the parser first
- `src/theory/chords.js`
  - exact/ranked chord template matching
- `src/analysis/harmonic-objects.js`
  - functional/contextual analysis of harmonic object sequences
- `tests/audio-harmony.test.js`
  - existing HHF-3.3 tests

Current accepted behavior must remain intact.

## Work priority order

Work as far down this list as time allows. **Commit only coherent, passing increments.** If allowance is nearly exhausted, stop at the last green checkpoint and write what remains into this file or a new `HHF3_4_PROGRESS.md`.

### P0 — Inspect and baseline

Run immediately:

```bash
cd holographic-harmony
npm ci
npm test
npm run build
```

If baseline fails before edits, stop and report the exact failure. Do not build on a red baseline.

### P1 — Add a score-derived sonority/reference engine

Create a deterministic module, suggested path:

`src/inference/score-harmony.js`

Input should be parsed score notes / canonical note events. Output should be a **measured-from-score sonority timeline** suitable for validation.

Requirements:

- derive change boundaries from actual note onsets/offsets, not arbitrary fixed windows;
- at each stable interval, compute sounding pitch classes;
- preserve measured bass/MIDI-lowest sounding pitch where available from score;
- rank/expose chord interpretations using the existing chord engine, but keep the raw measured sonority separate from the interpretation;
- merge adjacent intervals only when the measured sounding state is equivalent or musically redundant under a documented deterministic rule;
- preserve onset/end/duration and source evidence;
- do not claim a chord label is a measured fact: sounding notes/bass are measured; root/quality/function remain analytical interpretations;
- feed the resulting harmonic-object sequence to existing functional analysis where possible.

Add focused tests using synthetic score events. At minimum test:

- a simple C-major -> G-major score produces two measured sonority regions;
- bass is measured correctly from MIDI register;
- passing/held notes do not create nonsensical zero-duration regions;
- ties/sustains continue sounding across boundaries;
- measured pitch set and inferred chord interpretation are kept separate.

### P2 — Add harmonic-region consolidation above HHF-3.3 micro-segments

Create a deterministic module, suggested path:

`src/inference/harmonic-regions.js`

The module must receive the existing HHF-3.3 `segments` and return a second, coarser timeline. **Do not mutate or delete `segments`.** Suggested output fields:

```js
{
  regionVersion,
  regions: [...],
  regionCount,
  // original micro segments still present
}
```

Each region should retain:

- onset/end/duration;
- constituent micro-segment indices;
- representative chord candidate(s);
- root/quality interpretation;
- aggregated chroma / observed pitch classes;
- ambiguity;
- evidence class `inferred-from-audio`;
- `bassPc: null` / unavailable bass evidence for chroma-v1;
- enough provenance to explain why multiple micro-segments merged.

Merge conservatively. Useful evidence can include:

- same root with compatible chord family (e.g. extension/suspension fluctuations around one harmony);
- high chroma cosine similarity;
- strong pitch-set overlap;
- shared candidate/root evidence;
- short ambiguous bridge between two highly compatible flanks.

Do **not** merge simply because two chord symbols are close in time. Do not force a target number of regions.

Add tests proving:

- compatible same-harmony micro-segments collapse;
- genuine C -> G change remains distinct;
- a very short ambiguous bridge can be absorbed only when both flanks strongly support the same region;
- distinct roots/collections are not smeared together;
- every source micro-segment is represented exactly once in the final regions.

### P3 — Compare audio regions with score reference

Create a pure comparison/calibration module, suggested path:

`src/validation/audio-score-comparison.js`

It should compare timelines without assuming perfect time alignment. Start with a bounded offset search rather than dynamic time warping unless DTW is clearly necessary and can be tested safely.

Required outputs should be transparent diagnostics, not one magic accuracy number. Include as much as practical:

- estimated audio<->score time offset;
- time-weighted root agreement;
- time-weighted pitch-set/chord-template agreement;
- boundary precision/recall or matched-boundary error within a tolerance;
- confusion summary for common root/quality mismatches;
- coverage / unresolved intervals;
- comparison of micro-segment count vs region count vs score-reference count.

Distinguish exact agreement from musically related alternatives. Do not call a score chord interpretation absolute truth; the score's note content is measured, while chord/root/function labels remain analysis of those notes.

Add deterministic synthetic tests including a known time offset.

### P4 — Wire regions into the app without losing HHF-3.3 detail

Update `src/app/collection-aware-app.js` and `src/styles/audio-harmony.css` minimally.

Desired phone behavior:

- headline/current harmonic state should follow the **coarser harmonic region** by default;
- region timeline should be the primary readable harmonic map;
- preserve the current micro-segment information as a drill-down / detail layer rather than deleting it;
- display something like `104 micro-segments -> N harmonic regions` so consolidation is explicit;
- retain alternatives/ambiguity and evidence labels;
- playback seeking remains synchronized;
- no giant vertical expansion tied to track duration.

For local MusicXML, expose the score-reference timeline even though playback is unavailable unless an audio file is also supplied.

If pairing an audio file and score file in one browser session is feasible within the remaining allowance without architectural hacks, add a small explicit control to load a matching reference score for the current audio and show comparison diagnostics. If this cannot be done cleanly in the available time, do not hack it; complete P1-P3 and leave the UI pairing for the next checkpoint.

### P5 — Local Springtime Ständchen validation, only if the private files are actually available to Work

The intended real-world validation pair is Springtime Ständchen:

- private score: `Springtime_Stanchen.musicxml`
- private recording: Springtime Ständchen MP3

Do not waste allowance searching the public repository for them; they are intentionally not there.

If Work can access both privately during this run:

1. run score reference analysis;
2. run audio inference + region consolidation;
3. estimate alignment offset;
4. record aggregate validation metrics only;
5. do **not** commit either private file or raw private-derived note/event data.

If the files are unavailable to Work, state that and continue with synthetic/test-fixture validation rather than stopping implementation.

## Acceptance gate for any checkpoint commit

Before claiming completion:

```bash
cd holographic-harmony
npm test
npm run build
```

All pre-existing tests must remain green, plus all new tests.

Also inspect the modified app at a narrow/mobile viewport if browser time remains. Verify:

- local audio still opens;
- HHF-3.3 micro timeline data still exists;
- region timeline is readable;
- no horizontal page overflow;
- current region changes during playback/seek;
- evidence wording remains accurate.

## Required checkpoint/report

If P1-P4 finish and pass, create:

`holographic-harmony/HHF3_4_SCORE_CALIBRATION_CHECKPOINT.md`

Include:

- exact branch + commit SHA;
- files changed;
- tests passed / failed;
- build result;
- implemented priority items;
- region algorithm and thresholds;
- score-reference semantics;
- validation metrics if a real private pair was available;
- any remaining limitations;
- explicit statement that private user music was not committed.

If allowance ends earlier, create/update:

`holographic-harmony/HHF3_4_PROGRESS.md`

with the same exactness and the **last known green commit**. Do not leave the branch in a broken state merely to maximize line count.

## Time-management instruction

This is intentionally ordered so useful work survives a short Work session. Do not spend the first half of the run writing a new plan. Begin at P0, implement P1, then P2, then P3, then P4. Run focused tests after each module and full tests/build at checkpoints. If time is running low, checkpoint the largest coherent green subset and report the next exact step.

## What the previous assistant did immediately before handing off

A new branch `harmonic-savant-hhf3.4-score-calibration` was created from exact accepted HHF-3.3 SHA `918c0d0152c1ef7d72ba8c0ce94b99c6e664e9ca`.

The assistant inspected the current audio harmony, collection-aware app, MusicXML parser, chord templates, tests, and build script. It began sketching a harmonic-region module conceptually, but **no implementation code from that sketch was committed to the branch**. Treat the repository branch as clean HHF-3.3 code plus this work-order document. Implement the production version yourself under the acceptance rules above.
