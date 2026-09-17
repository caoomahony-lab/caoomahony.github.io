# Harmonic Savant — HHF-020 Accepted Checkpoint

Status: **ACCEPTED / CHECKPOINTED**  
Branch: `harmonic-savant-v0.2-core`  
Ticket: **HHF-020 — Independent Continuation Scores**

HHF-020 adds independent continuation objectives without combining them into a universal recommendation.

Implemented dimensions:

- `functional`
- `voiceLeading`
- `corpusFrequency`
- `styleSimilarity`
- `novelty`
- `holographicContinuity`

Primary files:

- `src/continuation/scores/function-score.js`
- `src/continuation/scores/voice-leading-score.js`
- `src/continuation/scores/evidence-score.js`
- `src/continuation/scores/novelty-score.js`
- `src/continuation/scores/holographic-score.js`
- `src/continuation/score-candidate.js`
- `tests/continuation-scores.test.js`

## Evidence boundaries

Functional support is an explicit rule-based heuristic and is not a corpus probability. Voice-leading support is a bounded transform of the deterministic HHF-017/018 geometry. Corpus and style scores are unavailable unless evidence is actually supplied by the caller. Novelty is deterministic set-content distance from supplied recent harmony and is not aesthetic quality. Holographic continuity is a model-derived active/shadow continuity heuristic and is not a perceptual probability.

Missing evidence remains explicitly unavailable. It is never replaced with a fabricated default score.

`scoreContinuationCandidate(...)` intentionally returns:

```text
combinedScore: null
```

HHF-020 therefore cannot silently choose a single best chord. Combination belongs to HHF-021 and must use explicit user-visible weights.

## Acceptance

Full GitHub Actions branch gate:

```text
Run:    35217427978
Commit: 49068fc77889fe510232192431f7c893cd814010
Node:   v22.23.2
Tests:  108
Passed: 108
Failed: 0
Build:  PASS
```

The run covered the original Holographic Harmony application plus HHF-1, HHF-2, HHF-017, HHF-018, HHF-019 and HHF-020 together.

## Next ticket

HHF-021 — weighted continuation ranker. Any composite score must show the requested weights, effective weights, missing-data treatment and per-dimension contribution. It must never be presented as probability or universal harmonic correctness.
