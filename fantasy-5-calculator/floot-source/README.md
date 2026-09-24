# Complete Floot source — Lottery Geometry Calculator

This directory mirrors the accepted source for the [Lottery Geometry Calculator](https://fantasy5-geometry.floot.app), exported from Floot project `6b90f228-9b81-4511-9e6b-1c2f94e83ac9` at project version `1790140018087`. The manifest records the associated checkpoint and verification.

## What is included

- the polished responsive page and its CSS;
- the complete three-game 5D state-space helper;
- the exact Fantasy 5 850,668-set / 38×38 population-map helper;
- the Input, Button, Select, Textarea, and Switch components imported by the page;
- shared design variables and the page layout;
- all scientific helper specs used by this feature;
- `manifest.json` with the Floot project, checkpoint, version, live URL, and verification record.

Nothing required by the page's import graph is intentionally omitted.

## Restore into Floot

Use a normal Floot project with its standard seeded dependencies, then copy these files to the same paths shown here. Floot supplies React 19, `@radix-ui/react-select`, `@radix-ui/react-switch`, `@radix-ui/react-slot`, and `lucide-react`.

The named restore point in the existing project is:

- checkpoint: `Polish D-space batch graph for mobile and desktop`
- checkpoint ID: `efaeec39-e1fe-4ca3-9e1c-ab7387dd91f9`

## Verification

At export, four Floot spec files passed and the full project typecheck was clean. Preview browser checks at desktop and 393px width exercised Fantasy 5, Powerball white balls, Mega Millions white balls, both batch modes, special-ball paste, and a 16-draw Mega Millions batch (population RMS `0.2113`, equal-space RMS `0.3584`, high-zone `5/16`). Production verification follows republish.

The three batch modes' D×G populations are exact for each selected game's white-ball universe. The separate single-ticket realizable D×G population map is deliberately labeled Fantasy 5 only; it is not reused as a Powerball or Mega Millions census. This is geometry, not a lottery prediction.
