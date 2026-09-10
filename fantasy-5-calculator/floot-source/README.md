# Complete Floot source — Lottery Geometry Calculator

This directory is the exact source closure for the live [Lottery Geometry Calculator](https://fantasy5-geometry.floot.app), exported from Floot project `6b90f228-9b81-4511-9e6b-1c2f94e83ac9` at project version `1789009531390`.

## What is included

- the polished responsive page and its CSS;
- the complete three-game 5D state-space helper;
- the exact Fantasy 5 850,668-set / 38×38 population-map helper;
- the Input, Button, and Select components imported by the page;
- shared design variables and the page layout;
- all scientific helper specs used by this feature;
- `manifest.json` with the Floot project, checkpoint, version, live URL, and verification record.

Nothing required by the page's import graph is intentionally omitted.

## Restore into Floot

Use a normal Floot project with its standard seeded dependencies, then copy these files to the same paths shown here. Floot supplies React 19, `@radix-ui/react-select`, `@radix-ui/react-slot`, and `lucide-react`.

The named restore point in the existing project is:

- checkpoint: `Merged polished calculator with complete 5D geometry`
- checkpoint ID: `aae1c03e-6226-4c32-b5df-3793c38b6cab`

## Verification

At export, all three Floot spec files passed, the full project typecheck was clean, and production browser acceptance passed for Fantasy 5, Powerball white balls, and Mega Millions white balls. The Fantasy 5 reference reproduced cell `(30, 5)`, population `324`, and rank `#618 / 902`.

The exhaustive D×G population map is deliberately labeled Fantasy 5 only. The other two games use exact 5D coordinates and fixed-range counts without mislabeling Fantasy 5 census data.
