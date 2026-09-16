# Harmonic Savant / Holographic Harmony — Project Constitution

Status: **Canonical non-negotiable product goals and architectural constraints**  
Applies to: `/holographic-harmony/` and every deployment or derivative implementation built from it.

This document exists so that future builders can extend the project without accidentally shrinking its purpose. Features may be staged, delayed, improved, or replaced by proven-better implementations, but accepted goals are not to be silently discarded.

If this document conflicts with a lower-level work ticket, deployment note, UI convenience, framework limitation, or implementation detail, this document wins unless an explicit amendment is approved and documented.

---

## 1. Product definition

The finished system is a **free/user-file-first harmonic laboratory and harmonic search engine** combining four complementary ideas:

1. **Harmonious-style harmonic geometry** — pitch-class collections, scales, chords, complements, interval structures, set-class relationships, compatibility, and voice-leading relationships.
2. **Hooktheory-style functional language** — key-independent chord/function analysis, Roman-numeral thinking, progression exploration, transposition, continuation suggestions, and examples of related harmonic behavior.
3. **Holographic Harmony** — active field, exact shadow complement, reciprocal substitution, ordered revelation/admission, latent centers, center ambiguity, crystallization, and time-varying field behavior.
4. **Baseball Savant-style analytics** — stable measurable features, whole-song and artist fingerprints, decomposable similarity, nearest-neighbor search, filtering, adjustable weights, percentile/distribution views, and evidence-rich comparisons.

The visualizer is one interface over a deeper representation. The project is not complete when the circle animates correctly; it is complete only when the shared harmonic representation can power analysis, translation, comparison, continuation, search, education, and export.

---

## 2. Non-negotiable user capabilities

The following are permanent project goals unless an explicit impossibility is proven.

### 2.1 User-owned input without subscription lock-in

A user must be able to analyze their own supported files without being forced to pay a recurring subscription merely to access the core local analysis.

Initial symbolic inputs:

- MusicXML;
- MIDI.

Desired later inputs where technically reliable:

- supported chord/progression text;
- direct manual note/chord entry;
- audio-assisted analysis;
- additional documented symbolic formats.

Local-first analysis is preferred for private user files. Cloud storage or accounts may be optional features, not prerequisites for basic personal analysis.

### 2.2 Functional language must translate to any key

Functional representation must be key-independent at the canonical layer.

A progression represented functionally must be translatable to any user-selected tonic/key without changing its intended relative harmonic functions.

Examples of views that should be derivable from the same canonical state:

```text
Roman numeral:    I   vi   IV   V
Scale degree:     1   6    4    5
Nashville-style:  1   6m   4    5
C major:          C   Am   F    G
F# major:         F#  D#m  B    C#
Eb major:         Eb  Cm   Ab   Bb
```

The system must preserve enharmonic spelling separately from pitch class so that a mathematically equivalent transposition does not erase musically meaningful notation.

Transposition must be testable, deterministic, and reversible.

### 2.3 Multiple levels of explanation

The same analysis must be expressible at multiple expertise levels without changing the underlying fact.

At minimum:

- **raw/measured** — pitch classes, intervals, durations, probabilities, scores, set memberships;
- **theory** — Roman numerals, scale degrees, set classes, functions, modes, voice-leading relationships;
- **plain language** — explanations understandable to a beginner;
- **advanced analysis** — ambiguity, competing centers, Holographic state, similarity components, confidence and evidence.

A beginner-mode explanation must simplify language, not falsify the analysis.

Example:

```text
Theory:
V/vi → vi in C major

Beginner:
E major creates a strong pull toward A minor, then resolves there.

Measured:
E-G#-B → A-C-E; two common/nearby voices and dominant relation to A.
```

### 2.4 Export and platform portability

Analysis must not become trapped inside one host platform.

The canonical representation must support documented export adapters. Initial target formats should include, where semantically applicable:

- versioned JSON;
- CSV/tabular feature export;
- plain text;
- Markdown report;
- MusicXML transformation/export;
- MIDI transformation/export.

Later adapters may target DAWs, notation programs, data-analysis tools, notebooks, APIs, mobile/desktop wrappers, or other platforms with documented import mechanisms.

The standard is not a magical promise to support every unknown proprietary application. The requirement is that the core use open, documented representations and make new platform adapters straightforward without rewriting analysis logic.

### 2.5 Whole-piece harmonic fingerprinting

Every supported composition should be reducible to a versioned fingerprint built from measurable feature groups, including at minimum:

- relative pitch-degree distribution;
- duration-weighted pitch-degree distribution;
- attack-weighted distribution;
- bass-degree gravity;
- upper-voice degree distribution when derivable;
- interval-class spectrum;
- vertical sonority/set-class profile;
- chord/function vocabulary;
- chord/function transition matrix;
- root-motion profile;
- common-tone retention;
- voice-leading distance statistics;
- tonal/modal ambiguity;
- chromatic density;
- chromatic concentration versus dispersion;
- harmonic rhythm;
- register and texture;
- sectional contrast;
- opening/closing return;
- recurrence/motif features where reliable;
- center trajectory/modulation behavior;
- Holographic active/shadow/admission features.

Each fingerprint schema must be versioned.

### 2.6 Transposition-invariant comparison

Similarity must be able to ignore absolute key when the user requests functional comparison.

A composition in C and a composition in F# must be comparable after canonical normalization. The system should also report the best absolute transposition relationship when useful.

Similarity must be decomposable rather than presented only as one unexplained percentage.

Example:

```text
Overall harmonic similarity: 91%
Pitch ecology:               96%
Bass gravity:                89%
Interval vocabulary:         94%
Voice leading:               82%
Function transitions:        88%
Chromatic strategy:          93%
Holographic behavior:        85%
```

Users should eventually be able to adjust the weights.

### 2.7 Adjustable harmonic fingerprint / synthetic search

Users must eventually be able to edit harmonic coordinates directly and search the resulting neighborhood.

Examples:

- increase flat-2 weight;
- decrease tonic gravity;
- increase fifth-in-bass frequency;
- increase quartal/fifth sonorities;
- increase chromatic admissions;
- decrease cadential strength;
- increase common-tone preservation;
- change modal ambiguity;
- alter Holographic shadow behavior.

Changing these values should create a new query fingerprint, not destructively rewrite the source composition unless explicitly requested.

### 2.8 Functional chord analysis

Users should be able to enter a chord sequence or select a passage and receive plausible functional interpretations.

The engine must preserve ambiguity when multiple centers/functions are reasonable. It must not force one Roman numeral merely to produce a tidy answer.

Functional interpretation should be represented as candidates with evidence/confidence where appropriate.

### 2.9 Next-chord continuation engine

Given a progression or harmonic state, the system should generate candidate continuations and score them independently along multiple dimensions, including:

- functional plausibility;
- voice-leading smoothness;
- corpus frequency;
- similarity to a selected user/artist fingerprint;
- Holographic-field consequences;
- novelty/distance from current style.

There must not be one hidden universal definition of “best next chord.” Users should be able to see why different candidates win under different objectives.

### 2.10 Voice-leading engine

Voice leading must be modeled separately from chord-function labels.

Candidate voicings should eventually be evaluable by:

- total semitone motion;
- common-tone retention;
- bass movement;
- soprano movement;
- voice crossing;
- register constraints;
- octave equivalence;
- contrary/similar motion statistics;
- optional style-specific rules;
- optional instrument constraints such as piano range/hand span.

Functional strength and voice-leading economy must remain separately inspectable.

### 2.11 Similar-music and passage search

The system should support nearest-neighbor retrieval for:

- whole compositions;
- passages/windows;
- users' own libraries;
- external legal/public/reference corpora;
- artist/composer aggregates when sufficient data exists;
- synthetic fingerprints created with sliders;
- chord/function sequences;
- Holographic trajectories.

Search results should explain the match rather than return only titles.

### 2.12 Personal harmonic fingerprint

A user should be able to build an aggregate fingerprint from their own works.

The system should distinguish:

- corpus-wide stable traits;
- piece-specific deviations;
- evolution over time;
- preferred tonal fields;
- preferred bass behavior;
- preferred chromatic strategies;
- preferred functional transitions;
- preferred voice-leading characteristics;
- Holographic admission/center habits.

The aggregate must remain traceable back to source works and analysis version.

### 2.13 Artist/composer comparison

Where legally and technically supportable data exists, personal or song fingerprints should be comparable with artists/composers and historical works.

Comparisons must identify whether similarity is driven by pitch ecology, progression grammar, voice leading, texture, field behavior, or other components. A superficial “sounds like X” label is insufficient.

### 2.14 Feeling ↔ harmonic behavior

The long-term project should support both:

```text
feeling / descriptive phrase → harmonic neighborhoods + music examples
```

and

```text
measured harmonic fingerprint → associated descriptive/affective language
```

This layer must be empirical where possible. The project must not hard-code simplistic claims such as `minor = sad` as scientific truth.

Listener tags, corpus metadata, user annotations, and uncertainty should be preserved as data distinct from measured harmonic facts.

### 2.15 Holographic Harmony remains first-class

The Holographic layer is not disposable decoration.

The system must preserve the distinction between:

- active field `F`;
- exact shadow `S = Z12 \ F`;
- sounding shadow admissions;
- persistent admissions;
- reciprocal substitutions;
- center candidates;
- latent-center interpretations;
- crystallization candidates.

Exact set arithmetic must remain distinguishable from contextual interpretation.

### 2.16 Visualization remains time-aware

The current red/blue/white Holographic visualization should continue to evolve as a view of the canonical state, synchronized to the score/audio clock.

No later analytics UI should require abandoning the ability to watch harmonic state evolve through time.

---

## 3. Canonical architecture

The long-term dependency direction is:

```text
INPUTS
MusicXML / MIDI / manual chords / future supported sources
        ↓
CANONICAL EVENT MODEL
registered notes, timing, voice, staff, spelling, source provenance
        ↓
HARMONIC INTERMEDIATE REPRESENTATION (HIR)
relative degrees + absolute spelling + centers + chords + field state + windows
        ↓
ANALYSIS ENGINES
fingerprint / function / voice-leading / Holographic / recurrence / similarity
        ↓
VERSIONED DERIVED RECORDS
song fingerprints / passage fingerprints / artist aggregates / corpus index
        ↓
APPLICATION SERVICES
search / compare / transpose / continue / explain / export
        ↓
INTERFACES
web app / Observable / API / desktop-mobile wrapper / reports / external adapters
```

No UI framework or deployment platform may become the only place where canonical harmonic logic exists.

---

## 4. Harmonic Intermediate Representation requirement

A canonical Harmonic Intermediate Representation (HIR) must be developed before large-scale corpus/search features become authoritative.

HIR should retain both absolute and relative information.

Conceptual example:

```js
{
  schemaVersion: "hir-1",
  source: {...},
  events: [...],
  candidateCenters: [...],
  selectedReferenceCenter: {...},
  relativeEvents: [...],
  harmonicWindows: [...],
  functionalCandidates: [...],
  holographicStates: [...],
  provenance: {...}
}
```

Absolute pitch class must not be discarded merely because functional normalization is available. Relative and absolute views must coexist.

---

## 5. Key translation contract

The key-translation system must satisfy these invariants:

1. relative harmonic function is preserved unless the user explicitly requests reharmonization rather than transposition;
2. interval relationships are preserved under pure transposition;
3. voice/register can be preserved exactly or shifted by explicit voicing policy;
4. enharmonic notation is generated according to target key/context rather than naïve pitch-class naming;
5. original source is never destructively overwritten by a translated view;
6. every translation records source key/reference center, target key, interval shift, spelling policy, and engine version;
7. round-trip transposition should recover the original pitch classes exactly, modulo documented spelling policy.

The UI should allow users to choose a target tonic/key and immediately view:

- translated chord names;
- Roman numerals/functions;
- relative degree names;
- beginner explanation;
- optional rewritten MusicXML/MIDI export.

---

## 6. Explanation-language contract

Analysis should be representable through interchangeable renderers over the same data.

Planned renderers:

- `measured` — numeric/set/event evidence;
- `roman` — Roman numerals and conventional function labels;
- `degree` — scale-degree notation;
- `nashville` — Nashville-style numbers where appropriate;
- `notes` — actual note/chord names in selected key;
- `beginner` — concise ordinary-language explanation;
- `advanced` — ambiguity, alternatives, Holographic state and confidence;
- `machine` — versioned structured JSON.

A renderer may omit detail for readability but must not silently alter the underlying analysis.

---

## 7. Export/adapters contract

Core analysis must expose stable data that adapters can transform.

Proposed adapter interface:

```js
exportAdapter.export({
  analysis,
  target,
  options
})
```

Adapters should be independently testable.

No adapter may modify canonical analysis merely to satisfy a target platform. If a target cannot represent some information, the adapter must report lossiness.

Examples:

```text
JSON       lossless canonical analysis
CSV        tabular feature projection
Markdown   human-readable report
Text       portable explanation/progression
MusicXML   notation/transposition projection
MIDI       performance-neutral note projection
Observable visualization adapter
future DAW/notation adapters
```

---

## 8. Evidence classes

Every feature exposed to users should be assignable to an evidence class:

### A. Measured / deterministic

Examples:

- notes present;
- timing from symbolic score;
- pitch-class membership;
- exact complements;
- interval counts;
- deterministic transpositions;
- set-class calculations.

### B. Inferred analytical

Examples:

- candidate tonal center;
- chord root/function;
- modal reading;
- crystallization candidate;
- segmentation interpretation.

### C. Corpus-derived statistical

Examples:

- progression frequency;
- next-chord likelihood;
- nearest-neighbor similarity;
- percentile-like distributions.

### D. Subjective/semantic

Examples:

- emotion tags;
- descriptive language;
- stylistic associations.

The UI and API should not collapse these classes into one notion of certainty.

---

## 9. Better-way / replacement gate

The project explicitly welcomes superior methods. However, a claimed improvement cannot replace canonical behavior until it proves itself.

For any replacement of a parser, fingerprint feature, center estimator, chord-function engine, voice-leading metric, similarity metric, storage system, UI architecture, or deployment platform, require a written comparison containing:

1. problem being solved;
2. old behavior;
3. proposed new behavior;
4. preserved constitution goals;
5. test parity;
6. scientific/semantic parity;
7. benchmark results on representative real files;
8. performance/resource comparison where relevant;
9. migration requirements;
10. known losses;
11. rollback procedure;
12. reason the evidence demonstrates superiority rather than mere difference.

Until the gate passes, the new method remains experimental/additive.

A genuinely better method may replace an older one after passing this gate. The constitution protects capabilities, not obsolete code for its own sake.

---

## 10. Goal-removal gate

A constitution goal may be removed only if one of these conditions is documented:

### Impossible

The capability cannot be implemented because of a demonstrated mathematical, physical, legal, or unavoidable technical limitation.

### Superseded without loss

A new capability strictly contains the old capability and users lose no meaningful power.

### Explicit owner amendment

The project owner deliberately changes the project purpose with awareness of what will be lost.

The following do **not** qualify by themselves:

- implementation difficulty;
- cost of refactoring;
- a preferred framework lacking support;
- a platform vendor's limitation;
- schedule pressure;
- aesthetic preference;
- desire to simplify the roadmap.

If a host platform cannot support a goal, prefer another host or an adapter before deleting the goal.

---

## 11. Platform independence rule

The canonical analysis core must remain runnable outside Observable, Cloudflare, GitHub Pages, or any other single vendor environment.

A host should consume the engine rather than own it.

The target architecture should permit:

- local browser/PWA use;
- static deployment where sufficient;
- optional cloud corpus/search services;
- Observable analytical/dashboard views;
- future desktop/mobile packaging from the same web core;
- command-line/batch analysis where useful.

---

## 12. Data ownership and privacy

User-provided files should default to local processing/storage when practical.

If future cloud features upload scores, MIDI, recordings, fingerprints, or personal tags, the UI must distinguish local and cloud behavior clearly.

Derived public corpus statistics and private personal-source files should be separable.

---

## 13. Testing requirements

Every major layer must have deterministic tests before becoming canonical.

Required families include:

- parser fixtures;
- tempo/timing fixtures;
- transposition invariance;
- enharmonic spelling cases;
- `F ∩ S = ∅` and `F ∪ S = Z12`;
- fingerprint determinism;
- schema-version tests;
- similarity symmetry/normalization where intended;
- nearest-neighbor known cases;
- functional ambiguity cases;
- voice-leading known minima;
- export round trips where possible;
- user-file regression fixtures;
- stale-load/playback isolation;
- mobile/desktop browser acceptance.

Real user compositions should be included as non-destructive regression fixtures where permission and repository size allow.

---

## 14. Provenance requirements

Every saved fingerprint or derived corpus record should eventually retain:

- source identifier/hash;
- source format;
- parser version;
- HIR schema version;
- fingerprint schema version;
- analysis-engine version;
- configuration/weights;
- selected or candidate reference center(s);
- transformation/transposition history;
- timestamp/build identifier where useful.

A changed algorithm should create a new analysis version rather than silently changing the meaning of old stored numbers.

---

## 15. User-interface destination

The mature application should expose connected modes rather than disconnected utilities:

### Analyze

Upload/import a composition and inspect harmonic state and fingerprint.

### Translate

Choose any target key and see the same function in Roman numerals, degrees, note names, beginner language, and exportable notation/MIDI.

### Explore

Manipulate pitch-degree gravity, modes, chord sets, voice-leading priorities, Holographic variables, and other fingerprint coordinates.

### Continue

Enter/select chords and receive next candidates with separate functional, voice-leading, style, novelty, and field-consequence scores.

### Compare

Compare songs, passages, personal works, synthetic fingerprints, artists, and harmonic systems component by component.

### Search

Find nearest songs/passages by whole fingerprint, selected feature groups, progression, or Holographic behavior.

### Describe

Move between affective/descriptive language and empirically associated harmonic neighborhoods.

### Export

Export analysis, translated harmony, reports, data, or transformed notation through documented adapters.

---

## 16. Relationship to existing products

The project may learn from public concepts and interaction patterns of Harmonious, Hooktheory, and Baseball Savant, but must not depend on copying proprietary code, private data, or protected assets.

Where third-party data or APIs are considered, licensing and access constraints must be checked before integration.

The project should remain valuable using only a user's own files plus legally usable reference data.

---

## 17. Deployment doctrine

Observable is currently a visualization/deployment target, not the canonical source of musical logic.

Any Observable implementation must:

- read this constitution;
- preserve the core engine outside notebook/page-specific code;
- preserve key-translation capability;
- preserve explanation renderers;
- preserve exportability;
- preserve local/user-file-first goals;
- avoid platform-specific rewrites of theory;
- report platform limitations rather than deleting goals.

The same applies to every future deployment target.

---

## 18. Current implementation priority

Near-term work should prioritize the reusable foundation needed by every later capability:

1. complete and browser-accept v0.1;
2. canonical Event Model;
3. Harmonic Intermediate Representation;
4. key/reference-center normalization;
5. deterministic transposition engine;
6. versioned harmonic fingerprint schema;
7. fingerprint extraction from user MusicXML/MIDI;
8. explanation/rendering layers;
9. export adapters;
10. personal-library indexing and comparison;
11. function/chord engine;
12. voice-leading engine;
13. continuation scoring;
14. nearest-neighbor corpus search;
15. adjustable fingerprint explorer;
16. external corpus/artist layers;
17. empirical semantic/feeling layer.

Features later in the list remain goals even while deferred.

---

## 19. Definition of “complete”

The project should eventually allow a user to:

1. import their own music without subscription lock-in;
2. see synchronized Holographic behavior through time;
3. obtain a rigorous versioned harmonic fingerprint;
4. view the analysis in expert or beginner language;
5. translate functional harmony to any selected key;
6. export the result in open/useful formats;
7. compare any two supported works independent of key;
8. compare themselves to their own catalog and suitable external corpora;
9. alter fingerprint coordinates and search the resulting harmonic neighborhood;
10. enter chords and receive multiple functional interpretations;
11. receive next-chord candidates separated by function, voice leading, style, novelty, and field consequences;
12. inspect real examples of similar harmonic behavior when data permits;
13. search passages as well as whole songs;
14. aggregate artist/user fingerprints;
15. move between descriptive feeling language and harmonic neighborhoods with empirical uncertainty;
16. do all of the above without the project's canonical data or theory being locked to one deployment vendor.

This is intentionally ambitious. Scope may be staged; these goals are not to be silently sacrificed for convenience.

---

## 20. Amendment process

A future improvement may amend this constitution, but the amendment must be explicit.

Record:

- old requirement;
- new requirement;
- evidence for improvement;
- capabilities preserved;
- capabilities changed or lost;
- migration implications;
- approval/decision.

If a better method is proven, adopt it. If it is merely different, keep testing it without replacing canonical behavior.

---

## 21. Final governing principle

**Preserve user capability, scientific meaning, portability, and reproducibility first. Improve implementations aggressively, but do not reduce the accepted vision merely because a particular implementation or platform makes that vision difficult.**
