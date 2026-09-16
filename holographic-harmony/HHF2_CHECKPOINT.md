# Harmonic Savant — HHF-2 Accepted Checkpoint

Status: **ACCEPTED / CHECKPOINTED**  
Branch: `harmonic-savant-v0.2-core`  
Phase: **HHF-2 — Harmonic Objects and Function**

This checkpoint extends the accepted HHF-1 fingerprint foundation with symbolic harmonic objects, contextual functional language, ambiguity-preserving inference, root/chord behavior, modal ambiguity, and chromatic-strategy analysis. It is additive: the v0.1 visualizer compatibility surface remains intact.

---

## HHF-009 — Set-class engine

Implemented:

- deterministic pitch-class normalization;
- normal order;
- prime-form canonicalization;
- interval-class vectors;
- exact Z12 complements;
- transpositional-equivalence keys;
- inversional-equivalence keys;
- complete set-class descriptors.

Files:

- `src/theory/set-class.js`
- `tests/set-class.test.js`

Boundary: this engine does not claim external/Forte catalog numbers. Its canonical identities are independently computed and deterministic.

---

## HHF-010 — Chord-template engine

Implemented:

- common triads, suspended chords, sixth chords, sevenths, add-nine and ninth templates;
- exact chord matching;
- ranked incomplete/approximate sonority matching;
- support, coverage, precision and Jaccard evidence;
- slash-bass rendering;
- inversion descriptions;
- symmetric-root ambiguity preservation.

Files:

- `src/theory/chords.js`
- `tests/chords.test.js`

Rule preserved: incomplete or symmetric sonorities are not forced into one label when evidence does not justify it.

---

## HHF-011 — Center/scale inference refactor

Implemented:

- `src/inference/scales.js`;
- `src/inference/centers.js`;
- refactored `src/theory/inference.js` compatibility facade;
- explicit scale/system support metrics;
- multi-center hypotheses;
- optional bass evidence;
- separate `support` and `relativeWeight` terminology.

Files:

- `src/inference/scales.js`
- `src/inference/centers.js`
- `src/theory/inference.js`
- `tests/inference-refactor.test.js`

Important epistemic rule:

`relativeWeight` is a within-candidate-set normalization. It is **not a calibrated probability or factual confidence**. The legacy visualizer's `confidence` field remains only as a compatibility alias for the same relative weight.

The existing B-Lydian inference and crystallization regression tests remain green.

---

## HHF-012 — Contextual function engine and portable functional language

Implemented:

- contextual chord interpretation under candidate centers/systems;
- sequence-level competing hypotheses;
- ambiguity retention instead of forced single-key labeling;
- Roman-numeral rendering;
- Nashville-number rendering;
- scale-degree representation;
- target-key chord rendering;
- key-aware degree spelling;
- beginner-language rendering;
- shared canonical function object underneath all renderers.

Files:

- `src/theory/functions.js`
- `src/inference/function-engine.js`
- `tests/function-engine.test.js`

Verified example:

```text
Canonical function: I -> vi -> IV -> V
C major:            C -> Am -> F -> G
F# major:           F# -> D#m -> B -> C#
```

The translated chord names are renderings of the same functional relationships rather than separately analyzed progressions.

Beginner rendering simplifies terminology without changing the underlying function object.

Boundary: chromatic `#4/b5` currently uses a deterministic sharp-fourth orientation when a concrete degree spelling is required. More advanced contextual enharmonic spelling may extend this later without replacing the canonical chromatic coordinate.

---

## HHF-013 — Root-motion fingerprint block

Implemented:

- shortest directed semitone root motion;
- repeated-root rate;
- semitone and whole-step root-motion rates;
- fourth/fifth-class motion rate;
- tritone rate;
- unsigned root-motion distribution;
- weighted mean absolute shortest movement;
- global-transposition invariance.

Files:

- `src/fingerprint/blocks/root-motion.js`
- `tests/root-motion.test.js`

Root motion remains separate from voice leading. A root can move substantially while registered voices move very little.

---

## HHF-014 — Chord-transition block

Implemented:

- function/state transition counts;
- outgoing conditional probabilities;
- conditional entropy;
- 2- through 5-state n-grams;
- duration/weight support;
- repeated-state compression by default;
- fallback identities for nonfunctional/set-class states.

Files:

- `src/fingerprint/blocks/transitions.js`
- `tests/transitions.test.js`

Evidence is deterministic **under the supplied/inferred state labels**; the labels themselves may remain interpretive.

---

## HHF-015 — Modal ambiguity block

Implemented:

- center occupancy;
- system occupancy;
- normalized ambiguity entropy;
- ambiguity variance;
- top-center change rate;
- dual-center pair evidence;
- absolute or reference-center-relative coordinates;
- matched-transposition invariance in relative mode.

Files:

- `src/fingerprint/blocks/modal-profile.js`
- `tests/modal-profile.test.js`

This block explicitly represents competing centers instead of reducing cases such as shared-collection major/Lydian duality to one forced label.

---

## HHF-016 — Chromatic strategy block

Implemented:

- onset and duration outside-field rates;
- number of distinct foreign pitch classes;
- normalized concentration of foreign-class usage;
- average foreign-event duration;
- repeated foreign-pitch rate;
- foreign-event episode/clustering measurements;
- dominant foreign pitch/share;
- optional relationship of foreign episodes to later center changes;
- center-relative foreign-duration distribution for transposition-invariant comparison.

Files:

- `src/fingerprint/blocks/chromatic-strategy.js`
- `tests/chromatic-strategy.test.js`

This distinguishes low-density but structurally concentrated chromaticism from diffuse chromatic saturation.

---

## HHF-2 integration layer

Two additive integration modules were added so HHF-2 is usable as one system rather than disconnected utilities.

### Chord vocabulary fingerprint

`src/fingerprint/blocks/chord-vocabulary.js`

Provides:

- deterministic set-class distribution;
- sonority-cardinality distribution;
- inferred chord-template distribution;
- set-class entropy;
- chord-template entropy;
- labeled-weight share;
- examples with explicit support values;
- separate evidence classes for deterministic set arithmetic and inferred chord labels.

### Harmonic object sequence analyzer

`src/analysis/harmonic-objects.js`

`analyzeHarmonicObjectSequence(...)` combines:

- chord vocabulary;
- contextual function hypotheses;
- root motion;
- functional chord transitions;
- modal ambiguity;
- evidence-class metadata.

Integration tests verify that a symbolic `I-vi-IV-V`-equivalent pitch-class sequence is interpreted coherently and that the same function sequence renders correctly in F# as `F#-D#m-B-C#`.

File:

- `tests/harmonic-objects.test.js`

---

# HHF-2 acceptance verification

## Isolated implementation verification

During development, the HHF-2 modules were exercised in a minimal local Node test sandbox. The final HHF-2-focused subset passed:

```text
37 tests passed
0 failed
syntax checks passed
```

This was useful during construction but is not the final acceptance evidence.

## Full repository verification

A permanent GitHub Actions workflow was added:

`.github/workflows/harmonic-savant-ci.yml`

It checks out the actual branch and runs:

```text
npm ci
npm test
npm run build
```

First full branch acceptance run:

```text
GitHub Actions run: 35136671258
Node:               v22.23.2
Tests:              78
Passed:             78
Failed:             0
Build:              PASS
npm audit:          0 vulnerabilities
```

The run verified the original visualizer/parser tests, HHF-1 tests, legacy inference compatibility, and all HHF-2 tests together in the real repository.

---

# HHF-2 acceptance criterion

Master-plan criterion:

> arbitrary symbolic chord sequences return ranked contextual interpretations without forcing one key when evidence is ambiguous.

**Result: PASS.**

The implemented system now accepts symbolic pitch-class chord sequences, ranks chord and tonal-system interpretations, preserves competing hypotheses, renders functions as Roman numerals/Nashville numbers/beginner explanations or actual chords in a chosen target key, and exposes root-motion, transition, modal-ambiguity, set-class/chord-vocabulary and chromatic-strategy analysis.

---

# Important scope boundary

The event-based `extractHarmonicFingerprintV1(...)` exporter from HHF-1 still exports the original four event-derived foundation blocks only:

```text
pitchEcology
bassGravity
intervalSpectrum
registerTexture
```

HHF-2's chord/function/modal/chromatic modules are implemented and tested through the separate harmonic-object analysis surface. They are **not falsely marked as populated in the event-based fingerprint exporter** yet, because reliable event-to-sonority/state segmentation must be defined before those blocks can be derived automatically from arbitrary score events.

That integration should be added deliberately in a later ticket rather than fabricating chord/function states from raw note events.

---

# Next phase

Do not begin HHF-3 implicitly from this checkpoint.

HHF-3 is the voice-leading and continuation phase:

- HHF-017 voice-leading distance;
- HHF-018 voicing enumerator;
- HHF-019 candidate chord generator;
- HHF-020 independent continuation scores;
- HHF-021 weighted continuation ranker;
- HHF-022 chord-sequence input UI.

Before HHF-3, this checkpoint should be treated as the stable accepted harmonic-object/function baseline.
