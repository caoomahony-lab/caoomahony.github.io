# HHF-3.5 — Audio Pitch Evidence v2

Branch: `harmonic-savant-hhf3.5-audio-pitch-v2`

Parent production SHA: `5cf672902954f7c5b50776b51dcd54e169e5afee`

## Purpose

Improve the weakest currently measured layer: audio pitch evidence. Preserve the existing harmonic/collection architecture and keep score evidence strictly evaluative.

## Implementation

- Adds `audio-pitch-evidence-v2`.
- Keeps the prior FFT pitch-class projection as the dominant signal and blends a small harmonic-salience channel (default 10%).
- Harmonic salience evaluates candidate note fundamentals plus weighted partials after a local spectral-floor subtraction.
- Replaces fixed three-note assumptions with an adaptive sparse selector:
  - strongest pitch always retained;
  - second/third require >= 0.525 of the strongest evidence;
  - a fourth pitch is admitted only when it is both strong (>= 0.60 of the leader) and close to the third (>= 0.82 of third-pitch strength).
- Adds an independent low-frequency bass channel using approximately 55–330 Hz evidence.
- Bass remains null unless the winning low-frequency pitch class clears a 0.45 relative-margin gate.
- Segment and region bass require additional temporal consensus before being admitted.
- Bass evidence can inform chord inversion/root ranking, but it remains inferred audio evidence and never becomes a score measurement.

## Private A/B diagnostic

The existing private Springtime Ständchen MP3/MusicXML pair was used only for local aggregate diagnostics. Neither asset nor derived note/event rows are committed.

Using the existing +5.35 s global alignment and the same 516 analysis frames, frame-level pitch evidence changed approximately as follows:

| Metric | deployed HHF-3.4 | HHF-3.5 v2 diagnostic |
| --- | ---: | ---: |
| Mean frame pitch-set Jaccard | 45.5% | 47.1% |
| Frame precision | 48.3% | 48.8% |
| Frame recall | 71.9% | 73.8% |
| Exact frame share | 15.7% | 18.6% |

The bass channel is deliberately selective. At its default confidence gate it produced a bass pitch class on about 40% of comparable private frames, with about 58% pitch-class agreement against the score's lowest sounding MIDI in this single piece. This is evidence quality, not a general accuracy claim.

## Scientific guardrails

- The score is not used to choose notes during production inference.
- No score-driven correction is injected into the audio path.
- New bass fields remain nullable.
- Existing micro-segment evidence remains available.
- Relative candidate weights are not probabilities.
- The old production SHA remains recoverable.

## Next verification

Run the full repository tests/build through CI. If green, evaluate harmonic-region/root metrics with the private pair and add constrained local timing alignment as a separate validation-only change.


## Validation-only local timing alignment

HHF-3.5 also adds a constrained windowed offset path above the existing global audio-minus-score offset. The local path is used only to diagnose performance timing drift. It is not fed back into pitch, bass, chord, region, or function inference.

Defaults:

- 8 s validation windows;
- +/-1.5 s search around the global offset;
- 0.1 s offset grid;
- maximum 0.6 s offset change per adjacent window;
- smoothness penalty to discourage gratuitous timing jumps.

The existing global comparison remains available and unchanged in meaning. The local path is an additive diagnostic, not a score-guided correction.
