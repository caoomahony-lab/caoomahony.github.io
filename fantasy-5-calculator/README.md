# Fantasy 5 Geometry Calculator

A dependency-free browser calculator for five distinct Fantasy 5 numbers from 1–42.

It sorts the ticket, computes the established D/G/H/L/C/C* geometry, maps the ticket to the 38×38 D/G grid, and compares its cell with the exhaustively enumerated 850,668-ticket universe.

## Run

Open `index.html` directly in a browser. No build step or server is required.

For a local HTTP server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Test

```sh
npm test
```

The test uses only Node.js built-ins and checks the preserved browser artifact, canonical universe constants, a uniform-gap control ticket, and fail-closed input validation.

## Floot handoff

Import the `fantasy-5-calculator` directory from `caoomahony-lab/caoomahony.github.io` on branch `main`. Treat `index.html` as the behavior and formula authority; improvements should preserve its existing calculations unless intentionally versioned.

