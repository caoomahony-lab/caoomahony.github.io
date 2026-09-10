# Lottery Geometry Calculator

The current polished application is live at **https://fantasy5-geometry.floot.app**.

This repository now contains the complete source closure for that live Floot build under [`floot-source/`](./floot-source/README.md). It includes the page, responsive styling, imported UI components, scientific helpers, and tests. The earlier single-file `index.html` remains only as a recoverable legacy standalone snapshot; it is not the canonical implementation.

## Current capability

- Fantasy 5, Powerball white balls, and Mega Millions white balls;
- canonical state `(D, S, qH, qK, qT)`;
- exact scale–translation base and range-conditioned tetrahedral q-space fiber;
- exact positive-integer gap-composition and state counts;
- certified exhaustive Fantasy 5 850,668-set / 38×38 D×G population map;
- fail-closed input validation and responsive desktop/mobile layout.

## Verify the export contract

```sh
npm test
```

The full runtime/scientific tests execute in Floot. At the recorded export, all three Floot spec files passed and the project typecheck was clean. See [`floot-source/manifest.json`](./floot-source/manifest.json) for the exact Floot project version and checkpoint.
