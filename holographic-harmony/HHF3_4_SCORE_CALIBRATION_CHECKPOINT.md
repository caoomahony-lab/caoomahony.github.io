# Harmonic Savant — HHF-3.4 Score-Calibrated Harmonic Regions Checkpoint

Branch: `harmonic-savant-hhf3.4-score-calibration`

Core implementation SHA: `264474e4a985325a706f6c6e775fc15a3a7ce7b0`\n\nPrivate local-pairing increment SHA: `f17dadf8a8fe9c42c41e1e17956efb20a683a050`

Pull request: [#2](https://github.com/caoomahony-lab/caoomahony.github.io/pull/2)

Latest GitHub Actions run: `35266955726`

## Verification

```text
npm ci
PASS — 0 vulnerabilities

npm test
164 passed / 0 failed

npm run build
PASS — Built static ES-module distribution in dist/
```

The repository-local execution environment was unavailable during this session, so these commands were executed by the repository's existing Harmonic Savant CI workflow against the PR merge ref. The accepted HHF-3.3 parent had already passed the same workflow. No test was weakened or skipped.

## Implemented

### P1 — Score-derived sonority/reference engine

Added `src/inference/score-harmony.js`.

- derives interval boundaries only from score note onsets and offsets;
- measures the sounding pitch-class set and lowest sounding MIDI/bass pitch class;
- drops zero-duration/grace-like events from stable regions;
- merges adjacent intervals only when measured pitch classes and measured bass MIDI are equivalent;
- naturally preserves tied/sustained sounding state across adjacent score events;
- keeps measured sonority fields separate from inferred chord/root/quality/function candidates;
- feeds the region sequence to the existing harmonic-object analysis stack;
- records explicit measured and inferred evidence classes.

### P2 — Harmonic-region consolidation above HHF-3.3

Added `src/inference/harmonic-regions.js` and integrated it into `src/inference/audio-harmony.js`.

The original HHF-3.3 `segments` array remains present and unmodified. The new result also exposes:

- `regionVersion`;
- `regionCount`;
- `regions`;
- `harmonicRegions`;
- `regionHarmonicAnalysis`.

Every region retains its constituent micro-segment indices, timing, aggregated chroma, observed pitch classes, alternative candidates, ambiguity, merge provenance, `bassPc: null`, and `inferred-from-audio` evidence.

Default conservative merge rules:

- same root + same template;
- same root + compatible chord family with chroma cosine >= `0.72` or pitch-set Jaccard >= `0.50`;
- same root + shared candidate-root evidence with chroma cosine >= `0.86` and pitch-set Jaccard >= `0.60`;
- an ambiguous bridge may be absorbed only when duration <= `0.90 s`, ambiguity >= `0.55`, and both flanks are independently compatible and share a root.

No target region count is forced. Relative weights remain explicitly non-probabilistic.

### P3 — Transparent audio/score comparison

Added `src/validation/audio-score-comparison.js`.

It reports separate diagnostics for:

- bounded audio-minus-score offset estimation;
- time-weighted root agreement;
- time-weighted pitch-set Jaccard agreement;
- exact pitch-set agreement;
- chord-template agreement;
- boundary precision/recall and mean error;
- audio coverage and unresolved time;
- root and quality confusion summaries;
- micro-segment, audio-region, and score-reference counts.

Defaults:

- offset search: `±8 s` in `0.1 s` steps;
- boundary tolerance: `0.5 s`;
- alignment objective: coverage multiplied by available root (`0.50`), pitch-set Jaccard (`0.35`), and exact-set (`0.15`) components.

This is not dynamic time warping and it does not emit a single claim of absolute harmonic truth. Score note content is measured; score chord interpretation, audio harmony, and alignment remain inferred layers.

### P4 — Region-first application surface

Updated `src/app/collection-aware-app.js` and `src/styles/audio-harmony.css`.

- the coarser audio region timeline is primary;
- current chord/function follows the current region;
- HHF-3.3 micro-segments remain available in a collapsible detail timeline;
- the summary exposes `micro-segments → harmonic regions`;
- both timelines remain seekable for audio;
- local MusicXML exposes a score-sonority reference timeline;
- after local audio analysis, a `Load matching score` control accepts a private MusicXML reference;
- the reference score is parsed and compared entirely in the browser without upload;
- transparent offset, agreement, boundary, coverage, count, and confusion diagnostics are displayed;
- loading the reference does not replace the audio, playback clock, or HHF-3.3 micro-segments;
- score labels explicitly distinguish measured notes/bass from inferred harmony;
- horizontal tracks scroll inside a bounded card; duration does not create document height.

## Tests added

- `tests/score-harmony.test.js`
  - C-major → G-major score regions;
  - measured lowest-MIDI bass;
  - passing/held-note boundary safety;
  - tied/sustained equivalence;
  - measured/inferred separation.
- `tests/harmonic-regions.test.js`
  - compatible same-root consolidation;
  - preservation of genuine root changes;
  - bounded ambiguous-bridge absorption;
  - protection against collection smearing;
  - exact one-time provenance for every micro-segment.
- `tests/audio-score-comparison.test.js`
  - known offset recovery;
  - explicit root/quality confusions;
  - exact vs related pitch-set agreement and unresolved coverage.
- `tests/audio-harmony.test.js`
  - integrated micro-segment provenance;
  - region-first score-aware browser surface;
  - bounded timeline CSS.

## Files changed from the HHF-3.3 checkpoint

- `holographic-harmony/src/inference/score-harmony.js`
- `holographic-harmony/src/inference/harmonic-regions.js`
- `holographic-harmony/src/inference/audio-harmony.js`
- `holographic-harmony/src/validation/audio-score-comparison.js`
- `holographic-harmony/src/app/collection-aware-app.js`
- `holographic-harmony/src/styles/audio-harmony.css`
- `holographic-harmony/tests/score-harmony.test.js`
- `holographic-harmony/tests/harmonic-regions.test.js`
- `holographic-harmony/tests/audio-score-comparison.test.js`
- `holographic-harmony/tests/audio-harmony.test.js`

## Remaining acceptance and limitations

- The private Springtime Ständchen MusicXML/MP3 pair was not available to this repository execution environment, so no private-pair metrics were fabricated.
- The local audio-plus-reference-score workflow is implemented, but a real browser/physical-phone session was unavailable for this exact branch. Browser behavior is covered by source-level integration tests, but audio opening, live seek synchronization, responsive rendering, and the new timeline's physical-phone behavior still require a deployed preview acceptance pass.
- Production was not changed.
- Private user music was not committed, uploaded, or published.
