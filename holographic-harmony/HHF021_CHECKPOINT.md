# Harmonic Savant — HHF-021 Accepted Checkpoint

Status: **ACCEPTED / CHECKPOINTED**  
Branch: `harmonic-savant-v0.2-core`  
Ticket: **HHF-021 — Explicit Weighted Continuation Ranker**

HHF-021 combines HHF-020's independent continuation dimensions only when explicit user weights or an explicit named preset are supplied.

Primary implementation:

- `src/continuation/rank.js`
- `tests/continuation-rank.test.js`

Supported score dimensions remain:

- `functional`
- `voiceLeading`
- `corpusFrequency`
- `styleSimilarity`
- `novelty`
- `holographicContinuity`

There is deliberately **no hidden default ranking**. Callers must provide either a weight object or a named preset. Presets are exported and inspectable; they do not claim to be universally correct.

Named presets currently include:

- `balanced`
- `functional`
- `voice-leading`
- `adventurous`
- `holographic`
- `my-style`

Missing-data policies are explicit:

- `renormalize` — ignore unavailable positively weighted dimensions for that candidate and renormalize over available evidence;
- `zero` — unavailable positively weighted dimensions contribute zero while retaining their requested weight in the denominator;
- `require` — exclude candidates missing any positively weighted dimension.

Every ranked result exposes raw dimension score, requested weight, effective weight, weighted contribution, missing weighted dimensions, and the active missing-data policy.

Composite scores are labeled `user-weighted-composite`. They are not probability, correctness, or a universal best-chord measure.

## Acceptance

Full GitHub Actions branch gate:

```text
Run:    35217680800
Commit: fb1922e2793ace7ec0d8cffcbac0ee62fea70351
Tests:  116
Passed: 116
Failed: 0
Build:  PASS
```

End-to-end tests verify:

```text
HHF-019 candidate generation
  -> HHF-020 independent scoring
  -> HHF-021 explicit weighted ranking
```

Changing user weights intentionally changes the resulting ordering. Tie-breaking is deterministic and source scored objects are not mutated.

## Next ticket

HHF-022 — chord-sequence input and continuation interface. It should expose the already-tested engine rather than reimplementing harmonic logic in the UI.
