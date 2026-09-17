# Harmonic Savant — HHF-3.3 Audio Harmonic Segmentation Checkpoint

Branch: `harmonic-savant-v0.2-core`

Purpose: convert ordinary local audio from a framewise chroma stream into a temporally stable, explicitly inferred harmonic sequence that can feed the existing HHF-2/HHF-3 analysis stack.

## Accepted implementation

Implementation SHA: `e89269e68289b61b091405b42729a4940b0a214e`

Pull-request CI run: `35260783493`
Core-branch CI run: `35260901962`

Verification:

```text
npm test
151 passed / 0 failed

npm run build
PASS
```

## Implemented

- `src/music/local-audio.js`
  - upgrades the local analyzer to `audio-chroma-v2`;
  - retains time-local chroma frames in addition to aggregate chroma and inferred pitch-class events;
  - preserves the explicit boundary that audio chroma is not score transcription.

- `src/inference/audio-harmony.js`
  - creates multiple chord candidates from each time-local chroma frame;
  - computes audio-derived support without representing it as a calibrated probability;
  - applies temporal path smoothing with explicit chord-change penalties;
  - suppresses brief runs so passing/chromatic disturbances do not automatically become stable harmonic segments;
  - aggregates stable segments and retains competing chord candidates with relative weights;
  - feeds the resulting segment sequence into the existing harmonic-object/function/root-motion/transition analysis stack;
  - keeps bass evidence unavailable rather than inventing inversion or bass identity from chroma alone.

- `src/app/collection-aware-app.js`
  - runs audio harmonic segmentation after local chroma analysis;
  - adds an `AUDIO HARMONIC TIMELINE` for local audio;
  - highlights the current inferred chord during playback;
  - exposes Roman/Nashville/role interpretation where the existing function engine supports it;
  - shows alternative chord hypotheses and labels their values as relative weights, not probabilities;
  - makes timeline segments seekable;
  - keeps HHF-3.2 collection/center separation active at the same time.

- `src/styles/audio-harmony.css`
  - provides responsive desktop/mobile rendering for the harmonic timeline.

- `tests/audio-harmony.test.js`
  - verifies stable C-major → G-major segmentation;
  - verifies a one-frame chromatic disturbance does not manufacture a stable chord change;
  - verifies ambiguity is retained and bass evidence remains unavailable;
  - verifies the browser surface includes the audio harmonic timeline.

## Scientific boundary

For ordinary audio input, chord boundaries, roots, qualities, and functional interpretations are inferred evidence. They are not measured score facts. This version does not infer reliable bass identity from the chroma layer, so slash-chord/inversion evidence must remain unavailable unless supplied by a later independent bass-analysis layer.

Temporal smoothing is used to distinguish stable harmonic regions from short-lived local spectral changes; it is not evidence that every retained segment is the unique correct harmonic analysis.

## Remaining acceptance

Source/CI acceptance is complete. Production deployment and physical-phone acceptance of the new harmonic timeline remain to be verified on a real local audio file.

The next scientific validation should compare audio-inferred Springtime Ständchen segments against the user-owned MusicXML score without committing or publishing that private composition.
