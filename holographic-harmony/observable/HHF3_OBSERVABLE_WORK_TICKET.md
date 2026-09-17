# WORK TICKET — HHF-3 Observable Deployment and Browser Acceptance

## Source

Repository: `caoomahony-lab/caoomahony.github.io`  
Branch: `harmonic-savant-v0.2-core`  
Project root: `/holographic-harmony/`

**Checkout the exact commit SHA supplied in the handoff message. Do not substitute a newer branch head.**

Start with:

1. `WORK_START_HERE.md`
2. `HHF022_CHECKPOINT.md`
3. `observable/OBSERVABLE_HANDOFF.md`
4. `PROJECT_CONSTITUTION.md`

The application and analysis engine are already implemented. This is a deployment/browser-acceptance task.

---

## Preflight — mandatory

From `/holographic-harmony/` run:

```bash
npm ci
npm test
npm run build
```

If any command fails: **STOP and report the exact failure.**

Do not reconstruct modules from an old ZIP, old Observable page, memory, or historical source.

---

## Deployment target

Mount the full application through:

```js
import { mountObservableHarmonicSavant } from "./observable/adapter.js";
```

Use:

```js
await mountObservableHarmonicSavant(root, tracks);
```

Resolve public demo score/audio assets with Observable `FileAttachment(...).url()` or the equivalent supported attachment mechanism.

Load these stylesheets exactly once:

```text
src/styles/app.css
src/styles/continuation.css
```

The legacy `mountObservableHolographicHarmony(...)` export must remain available but is **not** the HHF-3 acceptance target.

---

## Allowed deployment glue

Prefer **no repository source changes**.

If Observable genuinely requires host-specific glue, you may modify only files under:

```text
/holographic-harmony/observable/
```

unless a reproducible source defect is found.

If a source defect outside `/observable/` is found:

1. STOP.
2. Record the smallest reproducible defect.
3. Identify the exact file/module involved.
4. Do not redesign or reconstruct around it in Observable.

---

## Browser acceptance

Follow the full matrix in `observable/OBSERVABLE_HANDOFF.md`.

At minimum verify all of the following in a real browser:

- legacy visualizer still loads and behaves correctly;
- playback / pause / seek work;
- no ghost audio or stale state during repeated track changes;
- fixed/bounded circle and timeline layout;
- no console errors during normal operation;
- progression `Cmaj7 | E7/G# | Am9 | Fmaj7` parses;
- slash bass survives;
- **No composite ranking** produces no hidden overall ranking;
- declared `C major` progression `C | Am | F | G` renders `I | vi | IV | V`;
- translating that function to `F#` renders `F# | D#m | B | C#`;
- test a flat target tonic such as `Bb`;
- blank context tonic shows inferred context and preserves competing hypotheses;
- inferred relative weights are not presented as probabilities;
- current voicing `G2 D3 G3 B3` activates registered voice-leading evidence;
- at least one continuation displays a concrete closest target voicing;
- selecting different visible ranking presets uses explicit weighted ranking;
- unavailable corpus/style evidence stays unavailable;
- Holographic active/shadow coupling can be enabled/disabled without breaking continuation analysis;
- `Copy JSON` works where browser permissions allow, or its permission limitation is reported precisely;
- phone/narrow layout is usable without uncontrolled page-width overflow.

---

## Do not

Do **not**:

- rebuild the application;
- redesign harmonic theory;
- replace the parser;
- replace active/shadow semantics;
- add another playback clock;
- duplicate chord parsing in Observable;
- duplicate key/function inference in Observable;
- duplicate target-key translation in Observable;
- duplicate voice-leading in Observable;
- duplicate continuation candidate/scoring/ranking logic in Observable;
- invent corpus or style data;
- add a hidden default "best chord";
- present relative weights or continuation scores as probability;
- call shadow pitches "wrong notes";
- publish private user compositions;
- merge to `main` unless explicitly instructed.

---

## Required report

Return:

1. exact source commit checked out;
2. `npm ci` result;
3. `npm test` total/pass/fail;
4. `npm run build` result;
5. Observable project/page URL or exact deployment identity;
6. browser(s)/viewport(s) tested;
7. each acceptance item PASS/FAIL;
8. console errors/warnings, if any;
9. exact host limitations, if any;
10. any Observable-only commit SHA if host glue was required;
11. explicit statement that no merge to `main` occurred unless separately authorized.

A deployment is not accepted merely because the page renders. The interaction/browser matrix must be exercised.
