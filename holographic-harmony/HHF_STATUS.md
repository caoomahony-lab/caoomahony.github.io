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

---

## HHF-003 — Multi-resolution Analysis Windows

Status: **ACCEPTED / CHECKPOINTED**

Implemented in `src/analysis/windows.js`:

- validated window specs for seconds, quarter-beats, and measures;
- uniform, duration-overlap, and decay weighting modes;
- canonical local/phrase/field defaults;
- immutable window records containing canonical event references, indices, and weights;
- a whole-piece global window helper;
- zero-duration/grace event handling;
- no alternate event or timing representation.

Verification performed before checkpoint:

```text
npm test
25 tests passed / 0 failed

npm run build
passed

node --check src/analysis/windows.js
passed
```

The window engine consumes `NoteEventV1` directly. Beat windows use retained quarter-beat coordinates; measure windows use canonical measure numbers; seconds windows use canonical onset/end times.

---

## HHF-004 — Pitch Ecology

Status: **ACCEPTED / CHECKPOINTED**

Implemented in `src/fingerprint/blocks/pitch-ecology.js`:

- 12-bin chromatic functional labels: `1, b2, 2, b3, 3, 4, #4/b5, 5, b6, 6, b7, 7`;
- onset-weighted and duration-weighted relative-degree distributions;
- normalized entropy;
- ranked degree gravity;
- tonic and fifth shares;
- optional concentration inside a declared/reference field;
- weighted-window compatibility;
- exact invariance when notes, center, and field transpose together.

A real local regression on `Springtime_Stanchen.musicxml` produced an invariant profile under transposition; with F# treated as the comparison center its leading onset degrees were `5 > 1 > 6 > 3 > 7 > 2 > 4`.

---

## HHF-005 — Bass Gravity

Status: **ACCEPTED / CHECKPOINTED**

Implemented in `src/fingerprint/blocks/bass-gravity.js`:

- duration-weighted sounding-bass degree distribution;
- onset-context bass degree distribution;
- bass repetition probability;
- bass interval-class transition histogram;
- fourth/fifth motion rate;
- stepwise bass rate;
- optional chromatic-bass rate relative to a declared field;
- pedal persistence;
- dominant bass degree/share;
- transposition invariance.

The extractor uses the actually sounding lowest pitch over time rather than assuming the lowest newly attacked note is always the bass.

---

## HHF-006 — Interval-Class Spectrum

Status: **ACCEPTED / CHECKPOINTED**

Implemented in `src/fingerprint/blocks/interval-spectrum.js`:

- duration-weighted IC1 through IC6 vertical pitch-class spectrum;
- local variance by interval class;
- a declared descriptive dissonance-concentration measure (`IC1 + IC2 + IC6`), not an emotional claim;
- fourth/fifth share;
- thirds/sixths share;
- tritone share;
- optional time-range clipping;
- exact transposition invariance.

---

## HHF-007 — Register and Texture

Status: **ACCEPTED / CHECKPOINTED**

Implemented in `src/fingerprint/blocks/register-texture.js`:

- total MIDI span;
- absolute and duration-weighted median register;
- mean sounding bass/top registers;
- mean bass-top separation;
- duration-weighted simultaneity-cardinality distribution;
- mean simultaneity;
- attack density;
- span expansion/contraction behavior;
- normalized span slope;
- sparse/dense texture shares;
- registral-climax position;
- bass/top-stream independence.

Absolute register values are kept separable from transposition-invariant register-shape metrics.

---

## HHF-008 — Versioned Foundation Fingerprint Export

Status: **ACCEPTED / CHECKPOINTED**

Implemented:

- `src/fingerprint/schema.js` — `HarmonicFingerprintV1` schema/version contract;
- `src/fingerprint/extract.js` — unified foundation fingerprint extraction;
- `src/fingerprint/export.js` — deterministic canonical JSON serialization and validation;
- `tests/fingerprint-export.test.js` — schema, determinism, round-trip, transposition, immutability, and invalid-input checks.

The V1 fingerprint now exports these implemented normalized blocks:

```text
pitchEcology
bassGravity
intervalSpectrum
registerTexture
```

The following planned blocks are explicitly present as `null`/pending rather than fabricated:

```text
chordVocabulary
chordTransitions
rootMotion
voiceLeading
modalProfile
chromaticStrategy
temporalArchitecture
recurrence
holographic
```

Absolute center/register identity is stored separately from the normalized block. During development, a test initially failed because `centerPc` leaked into normalized `pitchEcology` and `bassGravity`; that was corrected by removing absolute center identity from normalized serialization. The final transposition-invariance test passes.

### Final foundation verification

```text
npm test
43 tests passed / 0 failed

npm run build
passed

node --check src/fingerprint/schema.js
passed

node --check src/fingerprint/extract.js
passed

node --check src/fingerprint/export.js
passed
```

Real-catalog local regression on `Springtime_Stanchen.musicxml`:

```text
canonical events:              751
duration:                      135.37735849056605 s
normalized fingerprint equal: yes after +3 semitone transposition
compact JSON size:             3868 bytes
implemented blocks:            4
pending blocks:                9
```

The real score remains private/local and was not committed to the public repository.

## Foundation Sprint Gate

HHF-001 through HHF-008 are green checkpoints. The project now has a real `MusicXML -> NoteEventV1 -> normalized HarmonicFingerprintV1 -> deterministic JSON` path.

Do not replace these contracts casually. Future tickets must extend the fingerprint additively and obey `PROJECT_CONSTITUTION.md` and the repository-wide `ENGINEERING_DOCTRINE.md`.

The next coding phase should begin with the remaining harmonic-description blocks, especially chord/set-class vocabulary and functional context, before building large UI surfaces or cloud infrastructure.
