# Harmonic Savant — HHF-3.2 Collection / Center Separation Checkpoint

Branch: `harmonic-savant-v0.2-core`

Purpose: prevent relative modes of one pitch collection from being displayed as unrelated field changes during adaptive score/audio analysis.

## Implemented

- `src/inference/collection-center.js`
  - groups scale/mode candidates by exact pitch-class collection;
  - scores collection membership separately from tonic/mode support;
  - exposes center/mode hypotheses only within the selected collection;
  - labels diatonic collections using major / relative-minor identity (for example `F# / D# minor collection`);
  - adds collection hysteresis so a plausible current collection is retained until a challenger is materially stronger.
- `src/app/collection-aware-app.js`
  - keeps active/shadow membership tied to the selected collection;
  - shows `CURRENT COLLECTION` independently from `CENTER / MODE HYPOTHESES`;
  - allows center/mode weights to move without manufacturing a field change;
  - uses the same collection-aware behavior for adaptive local audio and adaptive score analysis;
  - preserves exact paper-mode field behavior.
- `src/app/harmonic-savant-app.js`
  - mounts the collection-aware visualizer without changing the continuation/theory core.

## Acceptance case

The pitch classes of:

- F# Major
- D# Natural minor
- A# Phrygian

are recognized as one exact seven-note collection. They are therefore represented as competing center/mode hypotheses of the same active field rather than three separate field changes.

## Verification

GitHub Actions run: `35242996440`

Implementation checkpoint: `8877ab1c350b09813d28c8c4bf149197a4e5f425`

```text
npm test
147 passed / 0 failed

npm run build
PASS
```

New tests verify:

- relative modes group into one collection;
- modal emphasis can change while collection identity remains fixed;
- collection hysteresis suppresses marginal frame-to-frame switching;
- Harmonic Savant mounts the collection-aware browser visualizer.

## Scientific boundary

Collection identity and tonal/modal center are distinct inference layers. A change in the leading center hypothesis is not, by itself, evidence that the active pitch collection changed. Conversely, a sufficiently stronger competing collection may replace the retained collection under the explicit hysteresis rule.

The collection layer remains inferred evidence for ordinary audio input. It does not convert audio chroma into measured score facts.
