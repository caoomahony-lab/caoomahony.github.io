# Observable handoff — Harmonic Savant HHF-3

Observable is a visualization/deployment target for Harmonic Savant / Holographic Harmony. It is **not** the canonical owner of the theory, schemas, parser, fingerprint engine, transposition engine, explanation language, voice-leading engine, continuation engine, or export logic.

Before touching Observable, read:

1. `../PROJECT_CONSTITUTION.md`
2. `../HARMONIC_SAVANT_MASTER_PLAN.md`
3. `../WORK_START_HERE.md`
4. `../HHF022_CHECKPOINT.md`
5. repository-root `ENGINEERING_DOCTRINE.md`

If Observable cannot support an accepted project goal directly, preserve the goal in the core and use an adapter, alternate host, companion service, or later deployment target. Do not delete the goal merely to fit Observable.

---

## Current deployment task

This is an **integration/browser-acceptance task**, not a theory-development task.

1. Checkout exactly the branch/commit supplied in the Work handoff message.
2. Work only inside `/holographic-harmony/` except for reading repository governance documents.
3. Run:

```bash
npm ci
npm test
npm run build
```

4. If any command fails, **STOP** and report the exact failure. Do not reconstruct the application.
5. Use Observable `FileAttachment(...).url()` for bundled public/demo MusicXML/audio assets where needed.
6. Build the resolved `tracks` array with the same track shape already expected by the visualizer.
7. Mount the full HHF-3 application through:

```js
mountObservableHarmonicSavant(root, tracks)
```

from `observable/adapter.js`.
8. Load both stylesheets exactly once:

```text
src/styles/app.css
src/styles/continuation.css
```

9. Do not reproduce continuation logic in Observable notebook/page cells. The page should only resolve deployment assets, provide a host element, load styles, import the adapter, and mount the application.
10. Perform the browser acceptance matrix below.
11. If all acceptance checks pass, report the exact Observable URL/project identity, tested commit SHA, and any host-specific limitations. Do not merge branches or redesign architecture unless separately instructed.

The legacy adapter remains available:

```js
mountObservableHolographicHarmony(root, tracks)
```

Use it only for a deliberate v0.1/reference page. The HHF-3 acceptance target is `mountObservableHarmonicSavant(...)`.

---

## Required browser acceptance matrix

### A. Existing Holographic Harmony regression

Verify in the deployed page:

- application loads without console errors;
- demo track score loads;
- audio playback starts/stops;
- seeking follows the authoritative audio clock;
- repeated A→B→A track switching does not create ghost audio or stale analysis state when multiple tracks are configured;
- pitch circle remains fixed/bounded rather than growing with song duration;
- active pitches remain red-family heat;
- shadow pitches remain blue-family heat;
- recent shadow events can flash white;
- active/shadow fields remain an exact Z12 partition;
- inferred centers/crystallization remain visibly interpretive rather than measured facts.

### B. HHF-022 chord-input regression

Use at least this progression:

```text
Cmaj7 | E7/G# | Am9 | Fmaj7
```

Verify:

- progression parses without page-only theory code;
- slash bass `G#` is preserved;
- functional analysis renders;
- no composite continuation ranking appears while **No composite ranking** is selected;
- generated continuation candidates appear with provenance/source chips;
- unsupported chord grammar shows a controlled input error rather than crashing the page.

### C. Functional translation

Use a declared context where useful, for example:

```text
Context tonic: C
System: Major
Progression: C | Am | F | G
Translate to key: F#
```

Expected functional relationship:

```text
Roman:       I -> vi -> IV -> V
Nashville:   1 -> 6m -> 4 -> 5
F# major:    F# -> D#m -> B -> C#
```

Verify beginner-language text is derived from the same canonical function result rather than separately hard-coded progression labels.

Also test at least one flat target tonic such as `Bb`.

### D. Inferred tonal context / ambiguity

Leave context tonic blank for a progression that can be analyzed.

Verify:

- context is labeled **INFERRED**;
- multiple hypotheses can remain visible;
- displayed relative weights are described as hypothesis-relative evidence, **not calibrated probability**.

### E. Registered voice-leading

Supply a current voicing such as:

```text
G2 D3 G3 B3
```

Verify:

- voice-leading dimension becomes available for legal candidates;
- at least one candidate displays a concrete closest voicing;
- movement is reported in actual registered semitones;
- the UI does not label the voice-leading score as probability.

### F. Explicit continuation ranking

Verify **No composite ranking** first.

Then choose at least two different visible presets, for example:

```text
functional
voice-leading
```

Verify:

- a composite ordering appears only after a preset is selected;
- the selected preset/weights are visible or inspectable through the application output/session;
- changing presets can change ordering when objective evidence differs;
- unavailable evidence remains visibly unavailable rather than fabricated;
- composite score is presented as an objective/weighted score, not probability or universal harmonic correctness.

Also exercise the missing-evidence modes:

```text
renormalize
zero
require
```

at least enough to confirm the controls do not crash and the result policy is respected.

### G. Holographic coupling

With **Use current visualizer active/shadow field** enabled:

- continuation session can consume the active/shadow partition exposed by the visualizer;
- Holographic continuation evidence is available where relevant;
- disabling the checkbox removes that optional context without breaking other continuation dimensions;
- shadow pitches are never called "wrong notes".

### H. Export

After a successful continuation session:

- `Copy JSON` should work where clipboard permissions allow it;
- if Observable/browser clipboard permissions prevent copy, report that host/browser limitation without replacing the core session representation;
- exported/session JSON must preserve independent score dimensions and explicit ranking configuration when present.

### I. Responsive/browser behavior

Test at minimum:

- desktop width;
- phone/narrow width;
- enough interaction to create multiple continuation rows;
- no uncontrolled horizontal page growth;
- functional table may scroll inside its card if needed rather than forcing the whole page wider;
- no page-height dependence on song duration;
- no uncaught errors in browser console during normal progression analysis, ranking changes, playback, seeking, and track switching.

---

## Required track shape

```js
{
  id: "paper-demo",
  title: "Paper Demo — B Lydian → C Shadow",
  score: await FileAttachment("demo.musicxml").url(),
  audio: await FileAttachment("demo.wav").url(),
  audioOffset: 0,
  analysis: {
    mode: "paper",
    field: { name: "B Lydian / F# collection", pcs: [11,1,3,5,6,8,10], center: 11 },
    latentCenter: 0,
    shadowAdmissionOrder: [2,9,4,0,7]
  }
}
```

Use public/demo assets only unless the user explicitly authorizes publishing a real personal composition. The GitHub repository is public; do not upload private user music merely to satisfy deployment testing.

---

## Constitution requirements that every Observable implementation must preserve

Observable integration must not prevent or redefine these long-term capabilities:

- user-owned MusicXML/MIDI analysis without subscription lock-in;
- transposition-independent canonical function;
- translation of harmonic function to any selected target key;
- preservation of enharmonic spelling separately from pitch class;
- multiple explanation renderers: measured, theory, notes-in-key, beginner, advanced, machine-readable;
- open/documented export adapters;
- whole-song and passage fingerprints;
- decomposable similarity;
- function and voice-leading engines as separate analytical layers;
- multi-objective continuation ranking;
- Holographic active/shadow/admission semantics;
- platform-independent canonical analysis core.

An Observable page may expose only a subset at a given release stage, but deferred capabilities remain explicit goals rather than being removed from the architecture.

---

## Key translation and explanation rule

Observable consumes the core renderer. It must not recreate this mapping independently.

The same canonical analysis should be renderable as, for example:

```text
Roman numeral:   I -> vi -> IV -> V
C major:         C -> Am -> F -> G
F# major:        F# -> D#m -> B -> C#
Beginner:        simplified functional explanation from the same canonical object
Machine:         versioned structured session/fingerprint data
```

The exact beginner wording is interpretive presentation; the functional relationship comes from canonical analysis.

---

## Export rule

Observable must not become the only location from which analysis can be exported. Export adapters belong in the reusable core/application layer.

Current HHF-3 browser output can expose continuation-session JSON. Longer-term targets remain:

- JSON;
- CSV;
- plain text;
- Markdown;
- MusicXML transformations;
- MIDI transformations;
- future documented platform adapters.

If a target format is lossy, report what cannot be represented.

---

## Do not

- Do not add a second playback clock.
- Do not replace MusicXML with mandatory audio transcription.
- Do not turn the 12-pitch circle into a page-height visualization.
- Do not call blue/shadow pitches "wrong notes".
- Do not present candidate centers or crystallization as measured facts.
- Do not present `relativeWeight`, continuation dimensions, or weighted composite scores as calibrated probability.
- Do not invent corpus/style evidence when none is supplied.
- Do not add a hidden default "best chord" ranking.
- Do not redesign source architecture during deployment.
- Do not move canonical theory into notebook/page-only code.
- Do not fork chord parsing, function analysis, key translation, voice-leading, candidate generation, scoring, or ranking inside Observable.
- Do not publish the user's private compositions without explicit permission.
- Do not remove key translation, portability, beginner-language, export, fingerprint, search, continuation, or Holographic goals because Observable lacks a convenient primitive.
- Do not replace a canonical method merely because another method appears cleaner without passing the replacement gate in `PROJECT_CONSTITUTION.md`.

If Observable integration exposes a source defect, report the smallest reproducible defect and stop before architectural reconstruction.
