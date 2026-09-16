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

## Gate

Do not begin HHF-002 until HHF-001 remains green from this checkpoint. HHF-002 must consume the canonical event model rather than creating a second event representation.
