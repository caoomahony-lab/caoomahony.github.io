# Harmonic Savant — HHF-018 Accepted Checkpoint

Status: **ACCEPTED / CHECKPOINTED**  
Branch: `harmonic-savant-v0.2-core`  
Ticket: **HHF-018 — Voicing Enumerator**

HHF-018 converts harmonic chord objects into bounded sets of concrete registered MIDI realizations and reuses HHF-017 for voice-leading ranking.

Implemented in `src/continuation/voicing-enumerator.js` with tests in `tests/voicing-enumerator.test.js`.

Capabilities include configurable MIDI range, voice count, span, adjacent spacing, fixed bass/soprano pitch classes, doubling/unison policy, required tones, explicit omission policy, deterministic candidate caps, hard search-node caps, inversion metadata, doubling metadata, and voice-leading ranking through the canonical HHF-017 engine.

Extended-chord omission is conservative: the built-in `extended` policy permits omission of a perfect fifth in four-or-more-note template chords. Other omissions must be explicitly declared; the enumerator does not silently invent jazz-specific omission rules.

The first CI run exposed a test-authoring error: the implementation deliberately exposes non-enumerable `searchMetadata`, while the test incorrectly expected the property to be inaccessible. The test was corrected to validate the metadata rather than deleting useful diagnostics.

Acceptance run after correction:

```text
Commit: cbb0d5c57ad74f38958bc2c2eacd3d3a0e067a97
Tests: 95
Passed: 95
Failed: 0
Build: PASS
```

Scope boundary: HHF-018 does not choose which harmonic chord should come next. It only realizes a supplied chord and can rank those realizations by HHF-017 geometry. Candidate chord generation begins in HHF-019.
