# Harmonic Savant Core — Implementation Status

Branch: `harmonic-savant-v0.2-core`

## HHF-001 — Canonical Event Model

Status: **ACCEPTED / CHECKPOINTED**

Implemented:

- `src/model/events.js`
  - versioned `NoteEventV1` contract;
  - deterministic per-track event IDs;
  - finite/nonnegative timing validation;
  - normalized pitch classes in `[0, 11]`;
  - MIDI, octave, spelling, part, voice, staff, measure and source provenance;
  - retained quarter-beat score position for later beat/measure analysis;
  - immutable canonical event objects and immutable event arrays;
  - validation helper and legacy-note adapter.
- `src/music/musicxml.js`
  - preserves legacy `notes` output for compatibility;
  - adds stable source ordinals and MusicXML part IDs;
  - emits `eventsV1` and `eventSchemaVersion` additively;
  - accepts optional `{ trackId }` without changing existing two-argument callers.
- `tests/events.test.js`
  - canonical stream presence;
  - deterministic IDs;
  - uniqueness across one track;
  - timing/pitch/spelling invariants;
  - immutability / no source mutation;
  - invalid-timing rejection;
  - pitch-class normalization.

Verification performed before checkpoint:

```text
npm test
15 tests passed / 0 failed

npm run build
passed

node --check src/model/events.js
passed

node --check src/music/musicxml.js
passed
```

Real-catalog regression performed locally against `Springtime_Stanchen.musicxml`:

```text
parsed legacy notes: 751
canonical events:    751
invalid events:      0
duration:            135.37735849056605 s
parts:               1
```

The real score was used only as a private/local regression input and was not added to the public repository.

---

## HHF-002 — Transposition and Center Normalization

Status: **ACCEPTED / CHECKPOINTED**

Implemented in `src/theory/transposition.js`:

- `transposePitchClass(pc, semitones)`;
- `transposePitchSet(pcs, semitones)`;
- `transposeEvents(events, semitones, options)`;
- `rotateHistogram(histogram, semitones)`;
- `normalizeToCenter(histogram, centerPc)`;
- immutable transformed event streams;
- reversible pitch-coordinate transformations when MIDI range permits;
- explicit rejection of out-of-range MIDI rather than silent clipping;
- derived-event provenance through `derivedFromId`, `sourceSpelling`, and accumulated `transpositionSemitones`;
- timing remains unchanged by transposition.

Tests in `tests/transposition.test.js` verify:

- modulo-12 pitch transposition;
- pitch-set transposition;
- histogram rotation;
- center-normalized invariance under equal event/center transposition;
- source immutability;
- round-trip pitch recovery;
- timing preservation;
- MIDI range failure behavior.

Verification performed before checkpoint:

```text
npm test
20 tests passed / 0 failed

npm run build
passed

node --check src/theory/transposition.js
passed
```

Real-catalog regression performed locally against `Springtime_Stanchen.musicxml`:

```text
canonical events:              751
transposed events:             751
center-normalized histograms:  equal after +5 semitones
source events mutated:         no
```

### Important boundary

HHF-002 provides mathematically correct semitone transposition and center normalization. It does **not** yet claim full key-aware enharmonic respelling. Derived note names currently use a deterministic chromatic spelling policy while preserving `sourceSpelling`; later key/function rendering must choose musically appropriate spellings from key/system context instead of treating the temporary chromatic spelling as canonical theory.

## Gate

HHF-001 and HHF-002 are green checkpoints. HHF-003 must build analysis windows on the canonical event stream and must not introduce a second timing/event representation.
