# Harmonic Savant — HHF-017 Accepted Checkpoint

Status: **ACCEPTED / CHECKPOINTED**  
Branch: `harmonic-savant-v0.2-core`  
Ticket: **HHF-017 — Voice-leading distance**

HHF-017 adds a reusable voice-leading geometry engine without starting voicing generation or continuation ranking.

## Implementation

Primary file:

- `src/theory/voice-leading.js`

Test file:

- `tests/voice-leading.test.js`

## Core behavior

`voiceLeadingDistance(sourceVoicing, targetVoicing, options)` searches legal one-to-one voice assignments and minimizes the declared objective.

Default registered mode uses actual MIDI pitches and reports:

- minimum matched-voice semitone movement;
- explicit unmatched-voice count and penalty when cardinality changes;
- common-tone count and retention;
- bass pitch-class retention;
- soprano pitch-class retention;
- voice-crossing count;
- stepwise-moving fraction;
- large-leap fraction;
- per-voice source/target assignment;
- signed and absolute movement for each matched voice;
- motion-direction descriptors.

A scalar helper is also provided:

```js
voiceLeadingDistanceValue(source, target, options)
```

## Two coordinate modes

### Registered

```text
mode: "registered"
```

Uses MIDI register directly. C4 -> B4 is 11 semitones.

### Pitch-class

```text
mode: "pitch-class"
```

Uses shortest circular pitch-class movement. C -> B is 1 semitone downward.

This keeps registered performance geometry separate from octave-equivalent harmonic geometry.

## Optional octave displacement

Registered mode can permit bounded octave displacement of a target voice:

```js
{
  allowOctaveDisplacement: true,
  maxOctaveShift: 1
}
```

The original target voicing is retained in the result, while `targetAdjusted` and `octaveShift` make the chosen comparison realization explicit.

No silent MIDI clipping is allowed.

## Independent objective terms

The optimization cost can independently include:

- unmatched-voice penalty;
- voice-crossing penalty;
- common-tone bonus;
- bass-preservation bonus;
- soprano-preservation bonus.

These terms remain separate so a future continuation engine can expose them instead of hiding them inside one unexplained "smoothness" score.

The engine returns both raw matched semitone movement and the configured objective cost.

## Motion descriptors

The result reports:

- upward-moving voice count;
- downward-moving voice count;
- stationary voice count;
- contrary motion;
- similar-direction motion;
- oblique motion;
- exact equal-semitone parallel motion (`parallel-chromatic`).

The `parallel-chromatic` label is deliberately narrow: it means all matched moving voices use the same nonzero chromatic semitone displacement. It does not claim a complete species-counterpoint analysis.

## Determinism and safety

- input voicing order does not affect the result;
- assignments have deterministic tie-breaking;
- registered MIDI is validated to 0..127;
- unsupported modes fail closed;
- exhaustive search is bounded to 8 voices by default;
- octave displacement cannot be enabled in pitch-class mode;
- source inputs are not mutated.

## Full branch acceptance

GitHub Actions run:

```text
Run:      35216393202
Commit:   3ca80e98d8b246c122fdb2b8fbdd12ba4532c240
Node:     v22.23.2
Tests:    87
Passed:   87
Failed:   0
Build:    PASS
```

The run covered the original Holographic Harmony visualizer/parser behavior, HHF-1, HHF-2, and all HHF-017 tests together.

## Verified HHF-017 cases

The test suite verifies:

- minimum registered semitone assignment;
- input-order independence;
- registered versus pitch-class distance;
- bounded octave displacement;
- explicit unequal-voice handling;
- common-tone preference independently from crossing penalty;
- contrary / parallel-chromatic / oblique motion descriptors;
- pitch-class transposition invariance;
- fail-closed invalid inputs/options.

## Scope boundary

HHF-017 does **not** yet:

- generate candidate voicings;
- split notes between piano hands;
- impose instrument-specific fingering models;
- choose next chords;
- combine functional and voice-leading continuation scores;
- claim full contrapuntal legality.

Those belong to later HHF-3 tickets.

## Next ticket

HHF-018 — Voicing enumerator.

It may consume `voiceLeadingDistance(...)` but must not replace or duplicate its geometry.
