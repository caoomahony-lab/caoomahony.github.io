# HHF-3.6 — Built-in MusicXML I/O

Branch: `harmonic-savant-hhf3.6-musicxml-io`

Parent production SHA: `002de46a44edea353c7e7b63bd1a00f447505314`

## Scope

Add local, phone-friendly score conversion without pretending the current audio pitch-class analyzer is a full transcription system.

## Implemented

### MusicXML / XML
- existing MusicXML parser remains canonical for score analysis;
- original XML is preserved for exact re-save;
- normalized MusicXML 4.0 can be generated from the canonical note-event representation;
- parser exposes deterministic measure/time-signature metadata for export.

### MXL → MusicXML
- reads ZIP central directory locally;
- follows `META-INF/container.xml`;
- supports stored and DEFLATE-compressed entries;
- rejects encrypted archives and oversized/unsupported entries;
- exports the exact embedded MusicXML root document.

### MIDI → MusicXML
- parses Standard MIDI PPQ timing, note events, running status, velocity, tempo, meter, tracks and channels into the local canonical event model;
- rejects SMPTE-time files rather than guessing;
- converts MIDI into existing canonical NoteEventV1 events;
- generates MusicXML locally with `encoded-from-midi` provenance, focused on pitch/timing/tempo/meter rather than preserving every performance controller or original engraving detail;
- generated notation is an analysis representation, not a claim to reproduce original engraving or authored voices.

### Audio
Audio → MusicXML remains disabled. HHF-3.5 does not yet infer reliable registered MIDI pitch, rhythmic quantization, voices, rests or ties. The UI states this rather than exporting fabricated notation.

## UI

The local picker accepts audio, `.musicxml/.xml`, `.mxl`, and `.mid/.midi`.
The built-in converter exposes **Save MusicXML**, **Extract MusicXML**, or **Export MusicXML** according to source type.

All conversion occurs in-browser. No user score or audio is uploaded.


## Accepted implementation verification

Implementation head before this documentation-only checkpoint: `eba0da14912dfa775c4dec62501941f1b5798052`

GitHub Actions run: `35308854217`

```text
npm test
180 passed / 0 failed

npm run build
PASS — Built static ES-module distribution in dist/
```

Verified coverage includes:
- PPQ MIDI import and SMPTE fail-closed behavior;
- MusicXML export round-trip for pitch and quarter-beat timing;
- DEFLATE-compressed MXL root extraction through `META-INF/container.xml`;
- official plain-vs-compressed MusicXML MIME distinction;
- phone-facing converter controls and accepted file extensions.

Private user music was not committed or uploaded.
