# HHF-3 local-audio note-accuracy diagnostic

Date: 2026-09-17

## Scope

This checkpoint diagnoses the local-audio pitch-class path only. It does not change the MusicXML parser, playback clock, active/shadow semantics, or harmonic theory modules. The paired validation assets remained browser/local-only and were not added to Git.

## Reproduced defect

The reference score contains one or two simultaneous pitch classes for about 71% of its sounding duration. The audio harmony path nevertheless forced every frame-derived pitch set and every consolidated region to contain at least three pitch classes. Sparse evidence was therefore padded into an inferred triad before chord ranking.

The prior default relative floor (0.34) also admitted weak piano partials into region pitch sets. The most frequent extra pitch classes were consistent with harmonic-overtone intervals. This remains inferred audio evidence, not measured score evidence.

## Minimal correction

- Do not pad sparse audio evidence to three pitch classes.
- Use a 0.60 relative chroma floor and at most four pitch classes for audio micro-segments and harmonic regions.
- Use the same 0.60 evidence threshold for time-local pitch-class events.
- Preserve ambiguity, null bass evidence, and the existing playback architecture.

## Paired local validation

The comparison used one private audio/MusicXML pair entirely on the local machine. Values are time-weighted diagnostics after the existing bounded offset search.

| Metric | Before | After |
| --- | ---: | ---: |
| Region pitch-set Jaccard | 33.9% | 42.4% |
| Exact region pitch-set agreement | 0.0% | 10.4% |
| Region root agreement | 37.7% | 40.6% |
| Frame pitch precision | 46.8% | 47.6% |
| Frame pitch recall | 73.6% | 71.0% |
| Exact frame share | 13.8% | 15.7% |

The correction is deliberately precision-biased: it removes unsupported tones rather than filling a chord template. It does not claim transcription accuracy.

## Remaining limitation

The recording and score align at approximately +5.35 seconds, but a single global offset cannot represent local performance timing. A diagnostic timing-tolerance upper bound improved substantially within ±0.5 seconds, indicating that local timing drift and the 0.37-second analysis window account for part of the remaining disagreement. That upper bound is not reported as achieved accuracy.

Piano overtones also remain intrinsically ambiguous in a twelve-bin chroma representation. A future change should evaluate a dedicated polyphonic pitch estimator or constrained local time-warping as a separately versioned evidence layer, rather than embedding score answers in the audio analyzer.

## Verification

- `npm ci`: pass
- `npm test`: 165/165 pass
- `npm run build`: pass
- Local browser automation: blocked by the verification environment from opening `localhost`; no application runtime error was observed because the page could not be reached by that browser.
