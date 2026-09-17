# Harmonic Savant — HHF-022 Checkpoint

Status: **CORE/STATIC ACCEPTED; REAL-BROWSER ACCEPTANCE PENDING**  
Branch: `harmonic-savant-v0.2-core`  
Ticket: **HHF-022 — Chord-sequence input and continuation interface**

HHF-022 completes the planned HHF-3 code path from user-entered chord symbols through contextual analysis, target-key translation, candidate generation, independent continuation scores, optional explicit weighted ranking, concrete voicing suggestions, JSON export, and a thin browser panel.

## Core input layer

Files:

- `src/input/chord-symbols.js`
- `src/input/chord-sequence.js`

Implemented:

- common chord-symbol parsing into existing canonical chord templates;
- sharps/flats and Unicode accidentals;
- slash-bass preservation independent of pitch-class chord identity;
- registered pitch input by note name or MIDI number;
- registered voicing parsing;
- bar/comma/semicolon/newline sequence separators, plus simple whitespace-delimited progressions;
- explicit failure for unsupported grammar rather than silent guessing.

Enharmonic registered pitches preserve spelled octave semantics: for example `Cb4` maps to MIDI 59 and `B#3` maps to MIDI 60.

## Continuation session API

File:

- `src/continuation/session.js`

Primary API:

```js
buildContinuationSession({...})
```

The session can:

- accept a user-declared tonal center/system or infer competing contexts;
- preserve multiple inferred tonal hypotheses;
- render progression function as Roman numerals;
- render Nashville numbers;
- translate the same canonical function into any supported selected target tonic spelling;
- render beginner-language descriptions from the same function object;
- generate HHF-019 continuation candidates;
- calculate HHF-020 independent scores;
- optionally apply HHF-021 only when an explicit ranking configuration is supplied;
- use a registered current voicing to activate HHF-017/018 voice-leading evidence;
- accept Holographic active/shadow fields without making them mandatory;
- preserve corpus/style dimensions as unavailable unless real caller evidence is supplied.

No composite ranking is created by default.

## Browser layer

Files:

- `src/app/continuation-panel.js`
- `src/app/harmonic-savant-app.js`
- `src/styles/continuation.css`
- updated `src/main.js`
- updated `index.html`

The browser panel is deliberately thin. It calls the tested session API and does not implement separate harmonic theory.

Current controls include:

- progression input;
- optional declared context tonic;
- system selector;
- target-key translation input;
- optional registered current voicing;
- visible ranking preset selector;
- visible missing-evidence policy;
- optional use of the current visualizer active/shadow field;
- JSON copy/export.

Current result surfaces include:

- declared/inferred tonal context;
- competing inferred hypotheses and explicitly labeled relative weights;
- functional translation table;
- generated continuation candidates;
- six independent continuation dimensions;
- visible preset weights when ranking is requested;
- source/provenance chips;
- closest registered target voicing when voice-leading evidence is available.

## Backward compatibility

`src/main.js` preserves:

```js
mountHolographicHarmony(...)
```

and adds:

```js
mountHarmonicSavant(...)
```

The default static page mounts `HarmonicSavantApp`, which contains the existing `HolographicHarmonyApp` plus the additive continuation panel. The existing visualizer class and legacy mount remain available for Observable/backward compatibility.

## Verification

Core/session checkpoint:

```text
Run:    35218027450
Commit: 4e3c8fe005ff16748c40c6a3a92ef59d3397df8a
Tests:  133
Passed: 133
Failed: 0
Build:  PASS
```

Static UI wiring checkpoint:

```text
Run:    35218305111
Commit: bbe408f6c9a4e4b531479b86132b1b3fc8645ba0
Tests:  135
Passed: 135
Failed: 0
Build:  PASS
```

The full suite includes original Holographic Harmony behavior plus HHF-1, HHF-2, HHF-017 through HHF-021, HHF-022 input/session tests, and static UI smoke tests.

## Required remaining acceptance

**Real browser acceptance has not yet been performed for the new HHF-022 panel.**

Static/module CI cannot prove:

- actual DOM layout on phone/desktop widths;
- user interaction with all form controls;
- clipboard behavior;
- visual overflow/scroll behavior;
- coexistence with live playback during repeated use;
- Observable module/CSS loading behavior;
- browser console cleanliness during interactive continuation analysis.

These must be verified in a real browser deployment before HHF-022 is marked fully browser-accepted.

## Stop boundary

Do not reconstruct theory in Observable or in browser-only code to complete this acceptance. Observable/Work should deploy the tested modules through the adapter, load both stylesheets, and perform browser acceptance. If a browser/deployment limitation exposes a source defect, report the smallest reproducible defect and return it to the core branch for correction.
