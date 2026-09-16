# Observable handoff

Observable is a visualization/deployment target for Harmonic Savant / Holographic Harmony. It is **not** the canonical owner of the theory, schemas, parser, fingerprint engine, transposition engine, explanation language, or export logic.

Before touching Observable, read:

1. `../PROJECT_CONSTITUTION.md`
2. `../HARMONIC_SAVANT_MASTER_PLAN.md`
3. `../WORK_START_HERE.md`
4. repository-root `ENGINEERING_DOCTRINE.md`

If Observable cannot support an accepted project goal directly, preserve the goal in the core and use an adapter, alternate host, companion service, or later deployment target. Do not delete the goal merely to fit Observable.

## Current deployment task

1. Verify the canonical GitHub commit supplied in the handoff message.
2. Run `npm ci`, `npm test`, and `npm run build`.
3. Use Observable file attachments for bundled MusicXML/audio demonstration assets where appropriate.
4. Build a `tracks` array with resolved URLs from `FileAttachment(...).url()` where static attachments are used.
5. Mount the application through `mountObservableHolographicHarmony(root, tracks)` or copy the minimal compiled module surface if Observable requires it.
6. Ensure the application stylesheet is loaded exactly once.
7. Verify playback, seeking, repeated song changes, bounded layout height, mobile sizing, and console cleanliness.
8. Report any Observable limitation that prevents user-selected local file input, dynamic export, persistence, or future corpus/search features. Do not redesign core semantics to hide a host limitation.

## Required track shape

```js
{
  id: "springtime-standchen",
  title: "Springtime Ständchen",
  score: await FileAttachment("springtime.musicxml").url(),
  audio: await FileAttachment("springtime.mp3").url(),
  audioOffset: 0,
  analysis: {
    mode: "paper", // or "adaptive"
    field: { name: "B Lydian / F# collection", pcs: [11,1,3,5,6,8,10], center: 11 },
    latentCenter: 0,
    shadowAdmissionOrder: [2,9,4,0,7]
  }
}
```

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

## Key translation and explanation rule

When these features are implemented in core, Observable should consume them rather than recreate them locally.

The same canonical analysis should be renderable as, for example:

```text
Roman numeral:   I → vi → IV → V
C major:         C → Am → F → G
F# major:        F# → D#m → B → C#
Beginner:        home chord → relative minor → broadening chord → strong return-pull chord
Machine:         versioned structured HIR/fingerprint data
```

The exact beginner wording is interpretive presentation; the functional relationship comes from canonical analysis.

## Export rule

Observable must not become the only location from which analysis can be exported. Export adapters belong in the reusable core/application layer.

If Observable offers convenient downloads, those controls should call the same adapters used elsewhere.

Targets should include, as implementation matures:

- JSON;
- CSV;
- plain text;
- Markdown;
- MusicXML transformations;
- MIDI transformations;
- future documented platform adapters.

If a target format is lossy, report what cannot be represented.

## Do not

- Do not add a second playback clock.
- Do not replace MusicXML with mandatory audio transcription.
- Do not turn the 12-pitch circle into a page-height visualization.
- Do not call blue pitches "wrong notes".
- Do not present candidate centers or crystallization as measured facts.
- Do not redesign source architecture during deployment.
- Do not move canonical theory into notebook/page-only code.
- Do not remove key translation, portability, beginner-language, export, fingerprint, search, continuation, or Holographic goals because Observable lacks a convenient primitive.
- Do not replace a canonical method merely because another method appears cleaner without passing the replacement gate in `PROJECT_CONSTITUTION.md`.

If Observable integration exposes a source defect, report the smallest reproducible defect and stop before architectural reconstruction.
