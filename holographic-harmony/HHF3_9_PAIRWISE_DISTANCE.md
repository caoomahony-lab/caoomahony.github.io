# HHF-3.9 — Pairwise Musical Distance v1

HHF-3.9 separates a piece's descriptive fingerprint from musical identity comparison.

## Descriptive fingerprint

The six existing bars remain descriptive only: harmonic motion, recurrence, center clarity, collection adherence, pitch diversity, and surface activity. Their Euclidean proximity is no longer displayed as "% similar."

## Pairwise distance

For two analyzed audio pieces:

- **Material distance** = 0.45 motif + 0.30 melodic-interval + 0.25 relative-rhythm distance.
- **Structural distance** = 0.50 harmonic-transition + 0.30 recurrence-signature + 0.20 region-duration distance.
- **Stylistic distance** = 0.50 best-transposition chroma + 0.50 descriptive-profile distance.
- **Overall distance** = 0.45 material + 0.35 structural + 0.20 stylistic, renormalized when evidence is unavailable.

Melodic material uses a conservative registered-note top-line proxy and interval sequences, so a global transposition does not change melodic identity. Rhythm uses relative IOI ratios. Harmonic transitions use root motion plus chord-family transitions, also transposition-independent.

The three family displays are normalized **indices (0–100)**, not calibrated probabilities or literal percentages of shared music.

## Corpus calibration

When at least five HHF-3.9 descriptors are saved, the library contains at least ten pairwise baselines. The UI then reports an empirical **library similarity percentile**:

> the share of saved-library pair distances at least as large as the queried pair's distance.

This percentile is corpus-relative and is explicitly reported with the number of baseline pairs.

## Migration

Fingerprints saved before HHF-3.9 contain no sequence descriptor. Re-analyze and save those pieces once; the matching title is replaced locally.
