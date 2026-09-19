# HHF-3.7 — Registered-note transcription v1

Branch: `harmonic-savant-hhf3.7-registered-note-transcription`

Canonical parent: `bde9840b9a87c02b568c60806b9cc2bcff24d659`

## Purpose

Move the local audio analyzer from pitch-class-only evidence toward actual registered note candidates without pretending that the result is an authored score.

## Added evidence layer

`audio-registered-note-v1` estimates MIDI pitch/register per analysis frame.

The detector:

- reuses the same local FFT frame as HHF-3.5;
- scores candidate MIDI fundamentals across a bounded piano-like range;
- uses the actual fundamental as the dominant term;
- uses upper partials only as supporting evidence;
- applies a subharmonic guard so a strong overtone does not automatically become a false lower-octave note;
- gates candidates through the existing sparse pitch-class evidence;
- allows an octave doubling only when the second registered candidate is independently strong;
- can use the confidence-gated bass pitch class as a weak lower-register constraint.

## Temporal note tracking

Frame candidates are linked into persistent inferred registered-note events.

Each event preserves:

- onset in seconds;
- duration in seconds;
- MIDI note number;
- pitch class;
- octave;
- average confidence;
- observed frame count;
- evidence class `inferred-registered-audio`.

Short one-frame detections are suppressed by default and one missing frame can be bridged to reduce flicker.

## Separation from existing harmonic analysis

The existing pitch-class event stream remains unchanged and continues to drive field/collection/harmonic analysis.

Registered-note events are an additive transcription layer. They do not overwrite the existing chroma evidence or score-grounded calibration system.

## MusicXML boundary

HHF-3.7 does **not** yet enable audio → MusicXML export.

Registered pitch is now represented, but a defensible score still needs:

- beat/tempo estimation;
- rhythmic quantization;
- voice assignment;
- rest construction;
- tie decisions;
- notated spelling policy.

The UI therefore reports the number and coverage of inferred registered-note events while keeping audio → MusicXML disabled until those score-structure stages are added.

## Evidence semantics

- authored MusicXML note/register information: measured score evidence;
- MIDI note/register information: encoded event evidence;
- audio registered note/register information: inferred evidence;
- audio rhythm/voice notation: not yet claimed.

Private user audio and scores are not committed.
