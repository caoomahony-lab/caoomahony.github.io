# Holographic Harmony Visualizer

A browser visualizer for a time-varying twelve-pitch harmonic field. The application is modeled on the August 2026 *Holographic Harmony: Harmonic Geometry, Complementary Pitch Fields, and Transformative Tonality* framework.

## Core model

The registered score is retained internally, while the main display collapses octave-equivalent notes into `Z12` pitch classes. A defined local active field `F` and its exact chromatic complement `S = Z12 \\ F` are displayed simultaneously.

Visual semantics:

- **red** — member of the active field; brightness follows recent structural/activity weight
- **blue** — member of the exact shadow field; blue does not mean "wrong"
- **white flash** — a recent entry of a shadow pitch into sounding material
- **crystallization candidate** — contextual support for a configured latent center; explicitly interpretive

The application preserves the distinction between exact set arithmetic and tonal interpretation.

## Included paper regression fixture

The built-in demo starts from the B-Lydian/F# pitch-class collection:

`B C# D# E# F# G# A#`

Its exact five-note complement is:

`C D E G A`

The demo first admits those shadow classes in the paper sequence:

`D → A → E → C → G`

This is used as a regression fixture, not as a claim that every composition follows that sequence.

## Run locally

```bash
npm install
npm test
npm run dev
```

Production verification:

```bash
npm run check
```

## Architecture

- `src/music` — MusicXML and tempo-map parsing
- `src/theory` — pitch classes, active/shadow fields, activity, admissions, candidate inference
- `src/visualization` — fixed-size pitch circle and timeline
- `src/app` — lifecycle, atomic track changes, playback-linked rendering
- `public/tracks` — demo track and manifest
- `observable` — deployment adapter and handoff instructions
- `tests` — deterministic regression tests

Observable is intentionally not a dependency of the analysis engine.

## Song switching

Each load increments a generation token, aborts the previous fetch, pauses playback, clears state, and rejects stale asynchronous results. One HTML audio element supplies the authoritative playback clock.

## Current limitations

This release does not perform audio-only polyphonic transcription. MusicXML is authoritative for pitches and score timing. Candidate center/scale inference is deliberately lightweight and should be treated as analytical assistance rather than ground truth.
