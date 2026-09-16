# Holographic Harmony / Harmonic Savant — Master Implementation Plan

Status: **Canonical implementation blueprint before feature coding**  
Repository: `caoomahony-lab/caoomahony.github.io`  
Branch: `holographic-harmony-v0.1`  
Project root: `/holographic-harmony/`  
Baseline application commit before this plan: `60f68c3110df2302d46bac1fbec762ece4b872fa`

---

## 0. Executive definition

The finished system is not merely a Holographic Harmony visualizer. It is a **transposition-invariant harmonic analysis, fingerprinting, search, comparison, continuation, and semantic-retrieval engine** with a Holographic Harmony visualization layer.

The product combines three conceptual models without copying any external implementation:

1. **Holographic Harmony** supplies active field, shadow complement, reciprocal substitution, ordered revelation, center ambiguity, and crystallization as time-varying analytical features.
2. **Harmonious-style harmonic exploration** supplies the idea of navigating pitch-class collections, chords, set classes, compatible scales, interval structures, complements, and voice-leading relations.
3. **Baseball Savant-style analytics** supplies the interaction model: stable measurable features, percentile-like profiles, nearest-neighbor search, decomposable comparisons, filters, sliders, and evidence-rich result pages.

The central software contract is:

```text
MUSIC / CHORDS / SYMBOLIC SCORE
        ↓
CANONICAL EVENT REPRESENTATION
        ↓
TIME-VARYING HARMONIC STATE H(t)
        ↓
TRANSPOSED / NORMALIZED FINGERPRINT
        ↓
┌──────────────┬────────────┬─────────────┬──────────────┐
│ VISUALIZE    │ COMPARE    │ CONTINUE    │ DESCRIBE     │
│ active/shadow│ songs      │ next chords │ feeling→music│
│ centers      │ artists    │ voice lead  │ music→feeling│
│ admissions   │ systems    │ style match │ tags         │
└──────────────┴────────────┴─────────────┴──────────────┘
```

The visualizer is therefore one consumer of the harmonic representation, not the entire product.

---

## 1. Current baseline

The existing v0.1 application already establishes several foundations that must be preserved:

- MusicXML parsing and tempo mapping;
- retention of registered note metadata while collapsing the primary display to 12 pitch classes;
- active field `F` and exact shadow `S = Z12 \ F`;
- red active-field visualization;
- blue exact-shadow visualization;
- white transient shadow admissions;
- decaying activity heat;
- ordered admission history;
- lightweight candidate scale/center inference;
- candidate crystallization support;
- one authoritative audio playback clock;
- seeking and synchronized rendering;
- fixed-size pitch-circle visualization;
- fixed-size timeline;
- protected asynchronous track switching;
- Observable adapter/handoff separated from the analysis engine;
- deterministic regression tests, including the B-Lydian / C-D-E-G-A complement fixture.

The current code remains the **baseline runtime**. This plan expands it into a reusable analysis platform rather than replacing it.

### Approximate completion against the whole envisioned product

| Layer | Current maturity |
|---|---:|
| Existing Holographic visualizer | 75–85% |
| Core Holographic analysis | 45–55% |
| Formal harmonic fingerprint engine | 25–35% |
| Functional chord analysis | 15–20% |
| Voice-leading continuation engine | 10–15% |
| Transposition-invariant corpus search | 15–20% |
| Artist/song fingerprint database | <10% |
| Savant-style comparison/search UI | <10% |
| Editable fingerprint / slider explorer | <10% |
| Feeling ↔ harmony retrieval | ~5% |
| Entire product vision | ~20–25% |

These are engineering maturity estimates, not claims of scientific validation.

---

# PART I — ARCHITECTURAL RULES

## 2. Non-negotiable architecture principles

### 2.1 One canonical representation

Every feature must consume the same normalized event and harmonic-state models. Do not implement separate hidden logic for the visualizer, search engine, recommendation engine, and artist comparison.

### 2.2 Facts and interpretations remain separate

Every derived output must carry an evidence class:

```ts
type EvidenceClass =
  | "measured"        // exact from score/event data
  | "deterministic"   // exact under declared definitions
  | "inferred"        // model/context-dependent
  | "semantic";       // listener/tag association
```

Examples:

- pitch-class membership: measured;
- exact complement: deterministic;
- likely center: inferred;
- “haunting”: semantic.

### 2.3 Transposition invariance is first-class

A progression in C and the same progression in F# must be recognized as structurally equivalent when key identity is disabled.

Absolute pitch is preserved, but comparison defaults to normalized relative coordinates.

### 2.4 Time is not optional

A global histogram is insufficient. Every fingerprint must include both:

- whole-piece summary statistics;
- time-varying / sectional behavior.

### 2.5 Similarity must be explainable

Never return only `91% similar`.

Return a decomposed result such as:

```text
overall             91.2
pitch ecology       96.5
bass gravity        92.1
interval spectrum   90.4
chord behavior      88.7
root motion         86.3
voice leading       93.0
field trajectory    79.8
holographic behavior84.1
```

### 2.6 No single “correct” next chord

Continuation must expose different ranking objectives:

- functional continuation;
- voice-leading economy;
- corpus likelihood;
- user/style similarity;
- novelty;
- Holographic continuation.

A combined score is allowed only as an explicit weighted blend.

### 2.7 Observable is a client/deployment surface

Observable must not become the canonical location of theory or analysis logic. Analysis modules remain ordinary JavaScript modules with deterministic tests.

### 2.8 Corpus legality and reproducibility

External corpus data must come from one of:

- public-domain symbolic scores;
- permissively licensed datasets;
- user-provided material;
- independently derived metadata/features where permitted.

Do not build the product around scraping protected scores or storing copyrighted full-score content without permission.

---

# PART II — CANONICAL DATA MODEL

## 3. Event model

Add `src/model/events.js` and migrate parser output toward a versioned structure.

```ts
interface NoteEventV1 {
  id: string;
  trackId: string;
  partId?: string;
  voice?: number;
  staff?: number;
  measure?: number;

  onsetSec: number;
  durationSec: number;
  endSec: number;

  midi: number;
  pitchClass: number;          // 0..11
  octave: number;
  spelling?: string;           // C#, Db, etc.

  velocity?: number | null;    // if source supports it
  tieStart?: boolean;
  tieStop?: boolean;
  grace?: boolean;

  source: "musicxml" | "midi" | "manual";
}
```

### Acceptance

- deterministic IDs;
- no NaN timing;
- nonnegative duration;
- pitch class always in `[0, 11]`;
- original spelling retained when available;
- transposition operation does not mutate original source data.

---

## 4. Harmonic observation windows

Create `src/analysis/windows.js`.

The engine must support multiple concurrent resolutions:

```ts
interface AnalysisWindowSpec {
  id: string;
  mode: "seconds" | "beats" | "measures";
  size: number;
  hop: number;
  weighting: "uniform" | "duration" | "decay";
}
```

Recommended defaults:

- local: 1–2 beats;
- phrase: 2–4 measures;
- field: 8–16 measures or adaptive equivalent;
- global: whole composition.

No single window size should define the entire fingerprint.

---

## 5. Canonical HarmonicState

Create `src/model/harmonic-state.js`.

```ts
interface HarmonicStateV1 {
  time: number;
  windowStart: number;
  windowEnd: number;

  measured: {
    pitchClassActivity: number[];      // length 12
    onsetCounts: number[];             // length 12
    durationWeights: number[];         // length 12
    bassPitchClassActivity: number[];  // length 12
    topPitchClassActivity: number[];   // length 12
    intervalClassHistogram: number[];  // IC1..IC6
    simultaneityCardinality: number[];
    chromaticDensity: number;
    register: RegisterStats;
    attackDensity: number;
  };

  deterministic: {
    activeField?: number[];
    shadowField?: number[];
    setClass?: SetClassDescriptor;
    complement?: number[];
    commonToneCounts?: Record<string, number>;
  };

  inferred: {
    centerCandidates: CenterCandidate[];
    scaleCandidates: ScaleCandidate[];
    chordCandidates: ChordCandidate[];
    functionCandidates: FunctionCandidate[];
    localTension?: number;
    crystallizationCandidates?: CrystallizationCandidate[];
  };

  holographic: {
    admissions: AdmissionEvent[];
    withdrawalRate?: number;
    shadowActivation?: number;
    centerAmbiguity?: number;
    fieldPersistence?: number;
  };
}
```

This structure is the shared contract for visualization, fingerprint extraction, and comparison.

---

# PART III — HARMONIC FINGERPRINT SPECIFICATION V1

## 6. Fingerprint philosophy

A fingerprint must describe **what a piece tends to do**, not merely what notes occur.

The fingerprint therefore contains feature blocks. Each block can be:

- enabled/disabled for search;
- independently weighted;
- compared independently;
- displayed in the UI;
- normalized across transposition where appropriate.

Create:

```text
src/fingerprint/
  schema.js
  extract.js
  normalize.js
  blocks/
```

---

## 7. Fingerprint schema

```ts
interface HarmonicFingerprintV1 {
  schemaVersion: "1.0.0";
  sourceId: string;
  durationSec: number;

  absolute: AbsoluteIdentityBlock;
  normalized: {
    pitchEcology: PitchEcologyBlock;
    bassGravity: BassGravityBlock;
    intervalSpectrum: IntervalSpectrumBlock;
    chordVocabulary: ChordVocabularyBlock;
    chordTransitions: TransitionBlock;
    rootMotion: RootMotionBlock;
    voiceLeading: VoiceLeadingBlock;
    modalProfile: ModalProfileBlock;
    chromaticStrategy: ChromaticStrategyBlock;
    registerTexture: RegisterTextureBlock;
    temporalArchitecture: TemporalArchitectureBlock;
    recurrence: RecurrenceBlock;
    holographic: HolographicFingerprintBlock;
  };

  inferenceQuality: QualityBlock;
}
```

---

## 8. Block A — pitch ecology

File: `src/fingerprint/blocks/pitch-ecology.js`

Compute both onset-weighted and duration-weighted distributions relative to inferred/declared center.

```ts
interface PitchEcologyBlock {
  relativeOnsetDistribution: number[];   // 12 bins
  relativeDurationDistribution: number[];// 12 bins
  entropy: number;
  topDegrees: number[];
  tonicShare: number;
  fifthShare: number;
  diatonicConcentration: number;
}
```

### Required invariances

If all notes are transposed by `k` semitones and center is transposed by the same `k`, normalized output must remain equal within numerical tolerance.

---

## 9. Block B — bass gravity

File: `src/fingerprint/blocks/bass-gravity.js`

Measure:

- duration-weighted bass degree distribution;
- onset-weighted bass degree distribution;
- bass repetition probability;
- bass interval-class transition histogram;
- fourth/fifth motion rate;
- stepwise bass rate;
- chromatic bass rate;
- pedal persistence.

This block is separate because bass often communicates center/function more strongly than aggregate pitch counts.

---

## 10. Block C — interval-class spectrum

File: `src/fingerprint/blocks/interval-spectrum.js`

At representative sounding slices/windows, count unordered pitch-class interval classes:

```text
IC1 = m2/M7
IC2 = M2/m7
IC3 = m3/M6
IC4 = M3/m6
IC5 = P4/P5
IC6 = tritone
```

Store:

- global distribution;
- local variance;
- dissonance concentration;
- fourth/fifth share;
- thirds/sixths share;
- tritone share.

Do not infer emotional meaning from this block alone.

---

## 11. Block D — set-class and chord vocabulary

Files:

```text
src/theory/set-class.js
src/theory/chords.js
src/fingerprint/blocks/chord-vocabulary.js
```

Implement pitch-class set normalization independently of external sites.

Capabilities:

- normal order;
- prime-form canonicalization where needed;
- interval-class vector;
- transpositional equivalence;
- inversional equivalence as optional comparison mode;
- complement;
- chord-template labels;
- ambiguity list rather than forced single label.

Fingerprint outputs include:

- most frequent set classes;
- most frequent chord templates;
- cardinality distribution;
- chord-label entropy;
- tonic/subdominant/dominant-family prevalence where interpretable.

---

## 12. Block E — functional harmony

Files:

```text
src/theory/functions.js
src/inference/function-engine.js
```

Functional analysis must be contextual.

```ts
interface FunctionCandidate {
  centerPc: number;
  modeOrSystem: string;
  roman?: string;
  role?: "tonic" | "predominant" | "dominant" | "modal" | "chromatic" | "ambiguous";
  probability: number;
  explanationCodes: string[];
}
```

### Evidence inputs

- local center candidates;
- bass pitch;
- chord pitch set;
- metric/duration weight;
- preceding and following states;
- common tones;
- root motion;
- cadential patterns;
- active field / shadow relation.

### Rule

Never collapse ambiguous states to one label unless probability/support exceeds a configurable threshold.

---

## 13. Block F — chord-transition matrix

File: `src/fingerprint/blocks/transitions.js`

Represent transitions in normalized functional coordinates where possible.

Examples:

```text
I → vi
vi → IV
IV → V
V → I
```

Also keep nonfunctional pitch-set transitions so modal/atonal material remains representable.

Store:

- transition frequency;
- transition probability;
- conditional entropy;
- n-gram sequences (2–5 states);
- duration/harmonic-rhythm weighting.

---

## 14. Block G — root motion

File: `src/fingerprint/blocks/root-motion.js`

Store signed and unsigned root motion:

- ±1 semitone;
- ±2;
- ±3;
- ±4;
- ±5;
- tritone;
- repeated root.

Separate root motion from voice leading. A root can move a fifth while voices barely move.

---

## 15. Block H — voice-leading geometry

Files:

```text
src/theory/voice-leading.js
src/fingerprint/blocks/voice-leading.js
```

Base distance:

```text
d(A,B) = minimum total semitone movement over legal voice assignments
```

Support options:

- register-sensitive vs pitch-class-only;
- octave displacement;
- voice crossing penalty;
- bass preservation bonus;
- soprano preservation bonus;
- common-tone bonus;
- contrary-motion descriptor;
- parallel-motion descriptor;
- piano hand-span constraints as optional performance mode.

Fingerprint statistics:

- median voice-leading distance;
- 10/50/90th percentiles;
- common-tone retention;
- retained-bass rate;
- retained-soprano rate;
- stepwise-voice fraction;
- large-leap fraction.

---

## 16. Block I — modal profile / center ambiguity

File: `src/fingerprint/blocks/modal-profile.js`

Do not represent mode as one label only.

```ts
interface ModalProfileBlock {
  centerOccupancy: number[];      // 12 normalized center weights
  systemOccupancy: Record<string, number>;
  ambiguityMean: number;
  ambiguityVariance: number;
  centerChangeRate: number;
  dualCenterPairs: Array<{a:number,b:number,weight:number}>;
}
```

This captures cases like F# major / B Lydian shared-collection duality.

---

## 17. Block J — chromatic strategy

File: `src/fingerprint/blocks/chromatic-strategy.js`

Measure not only chromatic quantity but organization:

- outside-field note rate;
- number of distinct outside-field classes;
- concentration index of outside-field usage;
- average duration of foreign events;
- repeated foreign-pitch persistence;
- foreign-field episode count;
- chromatic event clustering;
- whether chromatic events precede center change;
- whether one foreign pitch dominates the chromatic vocabulary.

This distinguishes “low chromatic density with one structurally important pitch” from diffuse chromatic saturation.

---

## 18. Block K — register and texture

File: `src/fingerprint/blocks/register-texture.js`

Features:

- total pitch span;
- median register;
- bass/top separation;
- simultaneity cardinality;
- attack density;
- registral expansion/contraction;
- sparse vs dense texture;
- register-position of climax;
- bass/top-stream independence.

---

## 19. Block L — temporal architecture

File: `src/fingerprint/blocks/temporal-architecture.js`

Describe how the piece changes over time:

- section-to-section pitch-profile similarity;
- opening/closing similarity;
- energy-crest location;
- local entropy trajectory;
- field-change rate;
- density trajectory;
- register trajectory;
- harmonic-rhythm trajectory;
- departure → residence → return patterns;
- arrival-only patterns;
- monotonic accumulation patterns.

Store a downsampled normalized trajectory vector so pieces can be compared by shape independent of absolute duration.

---

## 20. Block M — recurrence / motif-adjacent harmonic memory

File: `src/fingerprint/blocks/recurrence.js`

Initial V1 scope should remain harmonic/rhythmic rather than claim full melodic intelligence.

Features:

- repeated interval sequences;
- repeated chord/function n-grams;
- repeated bass patterns;
- repeated harmonic-rhythm patterns;
- return of pitch ecology;
- return of exact field state;
- transformed-return similarity.

Full melodic motif extraction can be a later subproject.

---

## 21. Block N — Holographic Harmony fingerprint

File: `src/fingerprint/blocks/holographic.js`

This is the unique extension beyond conventional harmonic fingerprinting.

Features:

- active-field cardinality distribution;
- shadow cardinality distribution;
- field persistence;
- shadow activation rate;
- shadow admission rate;
- admission persistence;
- withdrawal rate;
- admission-order motifs;
- reciprocal substitution rate;
- latent-center support trajectory;
- crystallization candidate frequency;
- crystallization confidence distribution;
- center shift after shadow activation;
- complement coherence;
- active/shadow exchange distance.

The engine must distinguish exact set facts from inferred perceptual/tonal claims.

---

# PART IV — TRANSPOSITION AND NORMALIZATION

## 22. Transposition engine

File: `src/theory/transposition.js`

Operations:

```ts
transposePitchClass(pc, semitones)
transposePitchSet(pcs, semitones)
transposeEvents(events, semitones)
rotateHistogram(histogram, semitones)
normalizeToCenter(histogram, centerPc)
```

### Search modes

1. **absolute** — key matters;
2. **center-normalized** — tonic/center mapped to 0;
3. **best-rotation** — evaluate all 12 rotations and choose minimum distance;
4. **inversion-aware** — optional set-theoretic mode, not default musical mode.

Every similarity result must report the chosen transformation.

Example:

```json
{
  "transposition": 6,
  "mode": "best-rotation",
  "similarity": 0.941
}
```

---

# PART V — SIMILARITY ENGINE

## 23. Similarity architecture

Create:

```text
src/similarity/
  distance.js
  compare.js
  weights.js
  explain.js
  nearest.js
```

Each feature block returns a distance in `[0,1]`, where `0` means identical under that block's normalization.

Convert to similarity only for presentation.

### Candidate metrics

- cosine distance for distributions;
- Jensen–Shannon distance for probability histograms;
- Wasserstein/earth-mover distance where ordinal/circular structure matters;
- dynamic time warping or resampled trajectory distance for temporal curves;
- weighted Jaccard for set/class vocabularies;
- edit/sequence distance for admission or harmonic n-gram sequences.

The metric for each block must be explicit and tested.

---

## 24. Composite score

```ts
interface SimilarityWeights {
  pitchEcology: number;
  bassGravity: number;
  intervalSpectrum: number;
  chordVocabulary: number;
  chordTransitions: number;
  rootMotion: number;
  voiceLeading: number;
  modalProfile: number;
  chromaticStrategy: number;
  registerTexture: number;
  temporalArchitecture: number;
  recurrence: number;
  holographic: number;
}
```

Weighted distance:

```text
D = Σ(w_i * d_i) / Σ(w_i)
Similarity = 1 - D
```

Do not call this a probability.

### Presets

- `harmonic-core`;
- `voice-leading`;
- `modal-color`;
- `holographic`;
- `form-and-trajectory`;
- `all-features`;
- `my-style` (derived from user corpus);
- custom.

---

## 25. Nearest-neighbor index

Initial implementation can use exact linear search for small corpora.

When corpus size becomes large:

- precompute normalized vectors;
- store compact block vectors;
- introduce ANN index (HNSW or equivalent) only after exact-search correctness tests exist;
- rerank top ANN candidates with full decomposed similarity.

Correctness precedes search optimization.

---

# PART VI — USER / ARTIST FINGERPRINTS

## 26. Artist profile

An artist profile must not simply average all songs equally.

Create `src/fingerprint/aggregate.js`.

Store:

```ts
interface AggregateFingerprint {
  entityId: string;
  entityType: "artist" | "user" | "album" | "playlist" | "corpus";
  pieceCount: number;
  centroid: HarmonicFingerprintV1;
  spread: FeatureSpreadBlock;
  archetypes: ClusterSummary[];
  outliers: string[];
}
```

Features:

- centroid fingerprint;
- variance per block;
- major internal clusters;
- most characteristic features;
- least characteristic features;
- representative pieces;
- outliers.

This prevents an eclectic artist from being falsely represented by an average that matches no actual song.

---

## 27. Personal fingerprint

The user's corpus gets the same treatment.

UI should show:

- aggregate relative-degree profile;
- bass gravity;
- interval spectrum;
- chord/function preferences;
- chromatic strategy;
- center/modal tendencies;
- register/texture tendencies;
- form/trajectory tendencies;
- Holographic behaviors;
- internal clusters of pieces;
- evolution over time if dates exist.

No evaluative score is required. This is descriptive fingerprinting.

---

# PART VII — CHORD ANALYSIS AND CONTINUATION

## 28. Chord-input parser

Create:

```text
src/input/chord-symbols.js
src/input/chord-sequence.js
```

Support:

- common chord symbols;
- explicit pitch sets;
- optional voicing/register;
- slash bass;
- enharmonic spelling preservation;
- optional declared center/key.

Example accepted input:

```text
Cmaj7 | E7/G# | Am9 | Fmaj7
```

---

## 29. Functional interpretation engine

For each chord and sequence:

1. enumerate plausible centers/systems;
2. compute chord membership under each;
3. score local role;
4. incorporate preceding/following transitions;
5. output ranked functional interpretations;
6. carry ambiguity forward rather than resetting every chord.

The sequence context should be modeled with a beam of candidate interpretations rather than greedy one-chord labeling.

---

## 30. Continuation universe

Create `src/continuation/candidates.js`.

Candidate generation should include:

- diatonic triads/sevenths under current centers;
- secondary dominants;
- modal-mixture candidates;
- chromatic-mediant candidates;
- borrowed/pre-dominant candidates;
- Holographic shadow admissions;
- corpus-observed continuations;
- user-style observed continuations;
- optional broader set-class neighbors.

Bound candidate count and deduplicate enharmonic equivalents under selected mode.

---

## 31. Continuation scores

Create:

```text
src/continuation/function-score.js
src/continuation/voice-leading-score.js
src/continuation/corpus-score.js
src/continuation/style-score.js
src/continuation/novelty-score.js
src/continuation/holographic-score.js
src/continuation/rank.js
```

Return independent dimensions:

```ts
interface ContinuationCandidate {
  chord: ChordVoicing;
  functional: number;
  voiceLeading: number;
  corpusFrequency: number;
  styleSimilarity: number;
  novelty: number;
  holographicContinuity: number;
  explanations: string[];
}
```

### Combined user-controlled rank

```text
Score =
  wf*functional +
  wv*voiceLeading +
  wc*corpusFrequency +
  ws*styleSimilarity +
  wn*novelty +
  wh*holographicContinuity
```

Each slider must be visible to the user when combined ranking is used.

---

## 32. Voicing search

Given a candidate chord class, enumerate plausible voicings around current register.

Constraints:

- maximum voice count;
- configurable range;
- optional fixed bass;
- optional fixed soprano;
- optional no-crossing mode;
- optional piano span constraints;
- bounded search to avoid combinatorial explosion.

Return both:

- best functional chord class;
- best concrete voicing under selected voice-leading objective.

---

# PART VIII — CORPUS AND SEARCH

## 33. Corpus record

Create a versioned JSON storage format.

```ts
interface CorpusPieceRecord {
  id: string;
  title: string;
  composerOrArtist?: string;
  date?: string;
  sourceType: "public-domain" | "licensed" | "user" | "derived";
  sourceRef?: string;
  metadata: Record<string, unknown>;
  fingerprint: HarmonicFingerprintV1;
  segments?: SegmentFingerprint[];
}
```

Avoid embedding full copyrighted score content when not necessary.

---

## 34. Segment indexing

Whole-song matching is insufficient.

Index both:

- entire piece;
- sections;
- moving harmonic windows;
- chord sequences / function n-grams.

This enables:

> “Where does anyone use something like these four chords?”

instead of only:

> “Which entire song resembles mine?”

---

## 35. Search modes

### Song → songs

Nearest whole-piece fingerprints.

### Passage → passages

Nearest indexed segments.

### Artist → artists

Aggregate fingerprint comparison.

### Chords → examples

Search normalized chord/function n-grams.

### Fingerprint sliders → music

Construct synthetic target vector and retrieve nearest corpus entries.

### Harmonic system → examples

Query selected modal/set/function behaviors.

### User style → nearest external works

Compare aggregate user fingerprint to corpus.

---

# PART IX — SAVANT-STYLE PRODUCT UI

## 36. Top-level modes

The application should eventually expose six main modes.

### ANALYZE

Input MusicXML/MIDI/chords and produce a complete fingerprint.

### EXPLORE

Manipulate the fingerprint and see how theoretical/system labels and nearest corpus neighbors change.

### COMPARE

Song vs song, artist vs artist, user vs artist, passage vs passage.

### SEARCH

Nearest songs, passages, progressions, artists, systems.

### CONTINUE

Chord/function/voicing continuation candidates.

### DESCRIBE

Feeling/text ↔ harmonic retrieval.

The current 12-pitch Holographic visualizer remains embedded in Analyze/Explore rather than being discarded.

---

## 37. Fingerprint card

Every analyzed piece gets a card with compact metrics such as:

```text
Pitch ecology
Bass gravity
Interval spectrum
Modal ambiguity
Chromatic organization
Voice-leading economy
Root-motion profile
Harmonic entropy
Field persistence
Shadow activation
Return strength
Trajectory / crest
```

The UI may use percentile-style displays when a sufficiently defined comparison population exists. Do not display percentile language without a declared corpus/reference population.

---

## 38. Similarity comparison page

For two items, display:

- overall similarity;
- transformation/transposition used;
- block-by-block similarities;
- overlay histograms;
- temporal trajectory comparison;
- chord/function overlap;
- Holographic behavior comparison;
- “same” and “different” explanations;
- matched passages where available.

---

## 39. Fingerprint sliders

The Explore page exposes editable normalized features.

Minimum sliders/groups:

- degree weights (`1, b2, 2, b3, 3, 4, #4/b5, 5, b6, 6, b7, 7`);
- tonal concentration;
- center ambiguity;
- chromatic density;
- chromatic concentration;
- fourth/fifth sonority share;
- thirds/sixths share;
- tritone share;
- bass fifth gravity;
- pedal persistence;
- common-tone retention;
- root-motion fifth rate;
- voice-leading smoothness;
- harmonic-rhythm speed;
- field persistence;
- shadow activation;
- modulation rate.

Changing a slider constructs a synthetic target fingerprint and reruns nearest-neighbor search.

---

## 40. “What changed?” explanation

When sliders move, explain the displacement:

```text
You increased b2 emphasis from 3% to 18%.
Nearest neighbors moved toward pieces with stronger Phrygian/altered-second behavior.
Bass behavior stayed unchanged, so results still favor your previous pedal profile.
```

Do not infer genre from one slider alone.

---

# PART X — FEELING / SEMANTIC LAYER

## 41. Principle

Semantic descriptors are **empirical associations**, not theoretical truths.

The engine must never encode simplistic rules such as:

```text
minor = sad
major = happy
```

as factual mappings.

---

## 42. Semantic observation model

Create:

```ts
interface SemanticObservation {
  sourceId: string;
  segmentId?: string;
  tags: Array<{label:string, weight:number}>;
  raterType: "user" | "listener" | "editorial" | "dataset";
  raterId?: string;
}
```

Examples:

```text
haunting
weightless
menacing
nostalgic
luminous
restless
triumphant
cold
intimate
```

Keep provenance of every tag.

---

## 43. Feeling → harmonic retrieval

V1 should use retrieval, not generative certainty:

1. embed/query semantic tags;
2. retrieve tagged corpus segments;
3. aggregate their harmonic fingerprints;
4. show feature tendencies with uncertainty;
5. retrieve nearest untagged/other examples by harmonic similarity.

Output should say:

```text
Associated in this dataset with...
```

not:

```text
This harmony inherently means...
```

---

## 44. Personalized semantic model

User-specific mappings may differ from population mappings.

Store personal semantic observations separately and allow:

- `population mode`;
- `my perception mode`;
- blended mode.

---

# PART XI — STORAGE AND INDEXES

## 45. Local first implementation

V1/V2 can use static JSON artifacts generated at build time:

```text
data/
  fingerprints/
  corpus-index.json
  metadata.json
  semantic-tags.json
```

This keeps the early Observable/browser deployment simple.

---

## 46. Scalable storage later

When the corpus becomes large, separate:

- metadata DB;
- fingerprint vectors;
- ANN index;
- source provenance;
- semantic observations.

Do not introduce a backend until the static/indexed implementation proves the schema.

---

# PART XII — PROPOSED SOURCE TREE

## 47. Target project structure

```text
holographic-harmony/
├── README.md
├── WORK_START_HERE.md
├── HARMONIC_SAVANT_MASTER_PLAN.md
├── package.json
│
├── src/
│   ├── app/
│   ├── playback/
│   ├── visualization/
│   ├── music/
│   │   ├── musicxml.js
│   │   ├── midi.js                 # later
│   │   └── tempo-map.js
│   │
│   ├── model/
│   │   ├── events.js
│   │   └── harmonic-state.js
│   │
│   ├── theory/
│   │   ├── pitch.js
│   │   ├── transposition.js
│   │   ├── fields.js
│   │   ├── shadow.js
│   │   ├── set-class.js
│   │   ├── chords.js
│   │   ├── functions.js
│   │   └── voice-leading.js
│   │
│   ├── inference/
│   │   ├── centers.js
│   │   ├── scales.js
│   │   ├── chords.js
│   │   ├── function-engine.js
│   │   └── crystallization.js
│   │
│   ├── analysis/
│   │   ├── windows.js
│   │   ├── activity.js
│   │   ├── sections.js
│   │   └── trajectory.js
│   │
│   ├── fingerprint/
│   │   ├── schema.js
│   │   ├── extract.js
│   │   ├── normalize.js
│   │   ├── aggregate.js
│   │   └── blocks/
│   │       ├── pitch-ecology.js
│   │       ├── bass-gravity.js
│   │       ├── interval-spectrum.js
│   │       ├── chord-vocabulary.js
│   │       ├── transitions.js
│   │       ├── root-motion.js
│   │       ├── voice-leading.js
│   │       ├── modal-profile.js
│   │       ├── chromatic-strategy.js
│   │       ├── register-texture.js
│   │       ├── temporal-architecture.js
│   │       ├── recurrence.js
│   │       └── holographic.js
│   │
│   ├── similarity/
│   │   ├── distance.js
│   │   ├── compare.js
│   │   ├── weights.js
│   │   ├── explain.js
│   │   └── nearest.js
│   │
│   ├── continuation/
│   │   ├── candidates.js
│   │   ├── function-score.js
│   │   ├── voice-leading-score.js
│   │   ├── corpus-score.js
│   │   ├── style-score.js
│   │   ├── novelty-score.js
│   │   ├── holographic-score.js
│   │   └── rank.js
│   │
│   ├── input/
│   │   ├── chord-symbols.js
│   │   └── chord-sequence.js
│   │
│   ├── corpus/
│   │   ├── schema.js
│   │   ├── ingest.js
│   │   ├── segment.js
│   │   └── index.js
│   │
│   └── semantic/
│       ├── schema.js
│       ├── aggregate.js
│       └── retrieve.js
│
├── data/
│   ├── fixtures/
│   ├── fingerprints/
│   └── corpus-index.json
│
├── tests/
│   ├── theory/
│   ├── fingerprint/
│   ├── similarity/
│   ├── continuation/
│   ├── corpus/
│   └── regression/
│
├── scripts/
│   ├── fingerprint-file.mjs
│   ├── build-corpus.mjs
│   ├── compare-files.mjs
│   └── validate-corpus.mjs
│
└── observable/
    └── OBSERVABLE_HANDOFF.md
```

---

# PART XIII — TEST STRATEGY

## 48. Theory invariants

Tests must enforce:

```text
F ∩ S = ∅
F ∪ S = Z12
|F| + |S| = 12
```

Transposition:

```text
normalize(transpose(piece,k), center+k)
≈ normalize(piece,center)
```

Set-class canonicalization must be deterministic.

---

## 49. Synthetic fixtures

Create fixtures for:

- pure major scale;
- pure natural minor;
- Phrygian;
- Lydian;
- chromatic aggregate;
- I-IV-V-I;
- ii-V-I;
- modal vamp;
- chromatic-mediant sequence;
- pedal-point texture;
- smooth common-tone progression;
- intentionally poor voice-leading progression;
- B-Lydian shadow fixture.

Expected outputs should be hand-verifiable.

---

## 50. Real-score regression suite

Use selected user-owned MusicXML pieces as regression cases with stable expected high-level features, not fragile exact machine labels.

Examples:

- `Springtime Ständchen`;
- `Well Is Better Than Good`;
- `Scriabin in the Rain All Night`;
- `B Lydian`;
- `Greek AETUDE`;
- `Sitting on a Skyscraper Looking Down`;
- recent `Voice` files.

Regression assertions should focus on reproducible measured quantities and broad normalized fingerprint behavior.

---

## 51. Similarity sanity tests

Required:

1. piece compared with itself = maximum similarity;
2. globally transposed copy ≈ maximum under transposition-invariant mode;
3. shuffled pitch histogram but destroyed transition order should remain similar in pitch ecology but diverge in transitions/trajectory;
4. same chords with bad voicings should retain functional similarity but diverge in voice-leading similarity;
5. same notes with different bass should diverge in bass-gravity block;
6. field complement arithmetic must not change because of interpretive center ambiguity.

---

## 52. Continuation tests

For canonical progressions verify:

- function score behaves directionally as designed;
- voice-leading rank changes when voicing changes;
- corpus/style scores remain separate from theoretical score;
- novelty can favor unusual but valid continuations;
- combined ranking exactly matches user weights.

---

# PART XIV — IMPLEMENTATION ROADMAP

## 53. Phase HHF-1 — Fingerprint foundation

### HHF-001 — Canonical event model

- add `src/model/events.js`;
- adapt MusicXML parser output;
- preserve backward compatibility;
- tests.

### HHF-002 — Transposition normalization

- add `src/theory/transposition.js`;
- histogram rotation;
- event transposition;
- center-relative mapping;
- invariance tests.

### HHF-003 — Analysis windows

- reusable local/phrase/field/global windows;
- tests for timing boundaries.

### HHF-004 — Pitch ecology block

- onset and duration profiles;
- entropy/concentration;
- normalized degree hierarchy.

### HHF-005 — Bass gravity block

- bass extraction;
- pedal/repetition;
- bass motion histogram.

### HHF-006 — Interval spectrum block

- simultaneity sampling/windowing;
- interval-class vector.

### HHF-007 — Register/texture block

- span/density/cardinality features.

### HHF-008 — Fingerprint schema + exporter

Command:

```bash
node scripts/fingerprint-file.mjs <musicxml>
```

outputs versioned JSON.

**HHF-1 acceptance:** two transpositions of the same score produce near-identical normalized core fingerprints.

---

## 54. Phase HHF-2 — Harmonic objects and function

### HHF-009 — Set-class engine

### HHF-010 — Chord-template engine

### HHF-011 — Center/scale inference refactor

### HHF-012 — Contextual function engine

### HHF-013 — Root-motion block

### HHF-014 — Chord-transition block

### HHF-015 — Modal ambiguity block

### HHF-016 — Chromatic strategy block

**HHF-2 acceptance:** arbitrary symbolic chord sequences return ranked contextual interpretations without forcing one key when evidence is ambiguous.

---

## 55. Phase HHF-3 — Voice leading and continuation

### HHF-017 — Voice-leading distance

### HHF-018 — Voicing enumerator

### HHF-019 — Candidate chord generator

### HHF-020 — Independent continuation scores

### HHF-021 — Weighted continuation ranker

### HHF-022 — Chord-sequence input UI

**HHF-3 acceptance:** app can analyze a progression and return separately ranked functional, smoothest-voice-leading, style-like, and novel next-chord options.

---

## 56. Phase HHF-4 — Temporal + Holographic fingerprint

### HHF-023 — Section/trajectory extraction

### HHF-024 — Return/departure metrics

### HHF-025 — Admission persistence/withdrawal

### HHF-026 — Holographic fingerprint block

### HHF-027 — Recurrence block

### HHF-028 — Full Fingerprint V1 freeze

**HHF-4 acceptance:** fingerprint schema is stable, versioned, documented, and covers whole-piece plus temporal behavior.

---

## 57. Phase HHF-5 — Similarity search

### HHF-029 — Block distance metrics

### HHF-030 — Composite similarity engine

### HHF-031 — Best-transposition matcher

### HHF-032 — Similarity explanation generator

### HHF-033 — Exact nearest-neighbor search

### HHF-034 — Compare UI

**HHF-5 acceptance:** given two pieces in different keys, app identifies the best transposition, reports a decomposed similarity profile, and explains similarities/differences.

---

## 58. Phase HHF-6 — Personal corpus + artist system

### HHF-035 — Corpus schema

### HHF-036 — Corpus ingestion scripts

### HHF-037 — Segment indexing

### HHF-038 — Aggregate fingerprints

### HHF-039 — Cluster/archetype summaries

### HHF-040 — Personal fingerprint page

### HHF-041 — Artist/song profile pages

**HHF-6 acceptance:** user's corpus can be indexed and searched; aggregate profile has centroid, spread, clusters, representative pieces, and outliers.

---

## 59. Phase HHF-7 — Savant explorer

### HHF-042 — Fingerprint slider model

### HHF-043 — Synthetic target fingerprint

### HHF-044 — Live nearest-neighbor updates

### HHF-045 — “what changed?” explanation

### HHF-046 — Search/filter UI

### HHF-047 — Passage search

**HHF-7 acceptance:** user can alter normalized harmonic features and watch nearest songs/systems update without changing source music.

---

## 60. Phase HHF-8 — Semantic / feeling layer

### HHF-048 — Semantic observation schema

### HHF-049 — Tag ingestion

### HHF-050 — Feeling → corpus retrieval

### HHF-051 — Harmonic tendency summaries

### HHF-052 — Personal semantic mapping

### HHF-053 — Population/personal toggle

**HHF-8 acceptance:** a text descriptor retrieves tagged musical examples and reports associated harmonic tendencies with uncertainty/provenance, not deterministic emotional claims.

---

## 61. Phase HHF-9 — Scale and deployment hardening

### HHF-054 — Large-corpus performance benchmarks

### HHF-055 — ANN index if justified

### HHF-056 — Caching/version migration

### HHF-057 — Observable integration update

### HHF-058 — Browser/mobile acceptance

### HHF-059 — Documentation + provenance audit

### HHF-060 — v1.0 release candidate

---

# PART XV — IMMEDIATE CODING ORDER

## 62. What we code next

After the current Observable v0.1 deployment is verified, coding should begin in this exact order:

```text
HHF-001 canonical event model
HHF-002 transposition normalization
HHF-003 analysis windows
HHF-004 pitch ecology
HHF-005 bass gravity
HHF-006 interval spectrum
HHF-007 register/texture
HHF-008 fingerprint schema/exporter
```

Do **not** start the emotion model, artist database, ANN index, or continuation UI before HHF-1 passes.

The first major deliverable is therefore:

> **Harmonic Fingerprint V0.1: one command converts any supported MusicXML score into a deterministic, transposition-normalized fingerprint JSON with tested pitch, bass, interval, and texture blocks.**

That becomes the foundation for everything else.

---

# PART XVI — DEFINITION OF “COMPLETE”

## 63. Product completion criteria

The project is not considered complete merely because the visualizer works.

A complete first-generation system must be able to do all of the following:

1. ingest supported MusicXML and MIDI;
2. preserve registered events while normalizing harmonic comparison;
3. generate versioned Harmonic Fingerprint V1;
4. identify and display Holographic active/shadow behavior;
5. analyze chord sequences contextually;
6. represent ambiguity instead of forcing one function;
7. compare two pieces independent of key;
8. report best matching transposition;
9. decompose similarity by feature block;
10. search a corpus for nearest songs and passages;
11. aggregate pieces into user/artist fingerprints;
12. show internal artist/style variation and clusters;
13. accept user-edited fingerprint features;
14. update nearest neighbors from edited features;
15. recommend next chords under separate functional, voice-leading, corpus, style, novelty, and Holographic objectives;
16. search real corpus examples of a progression/behavior;
17. accept semantic/feeling queries using empirical tagged associations;
18. distinguish population semantic associations from personal ones;
19. preserve provenance/evidence class for every output;
20. run reproducible tests and browser acceptance on the deployed application.

---

# PART XVII — SCIENTIFIC / EPISTEMIC LIMITS

## 64. Claims the app may make strongly

With clean symbolic input, the app can be highly confident about:

- pitch identity;
- pitch-class distributions;
- exact complements;
- set operations;
- measured durations/onsets;
- interval-class distributions;
- registered voice movement under declared rules;
- transposition-equivalent transformations;
- explicit similarity calculations.

## 65. Claims that remain interpretive

The app must label uncertainty around:

- tonic/center when ambiguous;
- chord label in dense or incomplete sonorities;
- functional role;
- crystallization;
- formal function;
- listener-perceived tension;
- semantic/emotional description.

## 66. Audio caveat

MusicXML and MIDI can miss or distort:

- touch;
- pedal;
- dynamics;
- timing microstructure;
- rubato;
- voicing prominence;
- transcription errors.

Future audio-derived features may augment the symbolic fingerprint but should remain a separately identified evidence source.

---

# PART XVIII — VERSIONING

## 67. Schema versions

Every stored fingerprint must include `schemaVersion`.

Breaking metric changes require a new version and migration/rebuild path.

Never silently reinterpret previously stored vectors under new formulas.

Suggested progression:

```text
0.1 core pitch/bass/interval/texture
0.2 chord/function/modal/chromatic
0.3 voice-leading/temporal/Holographic
1.0 frozen first public fingerprint schema
```

---

# PART XIX — WORK / AGENT HANDOFF RULES

## 68. Bounded coding sessions

Every coding task should specify:

- canonical repo;
- branch;
- starting SHA;
- exact task ID;
- allowed directories;
- tests to run;
- acceptance conditions;
- stop conditions;
- prohibition on unrelated roadmap work.

Example:

```text
TASK: HHF-001 Canonical Event Model

Inspect current parser before editing.
Do not redesign playback or Observable deployment.
Add the event schema and adapter only.
Run full tests.
If parser behavior must change outside the task boundary, STOP and report.
```

This project should advance through verifiable checkpoints rather than a single giant autonomous implementation run.

---

# PART XX — FINAL PRODUCT STATEMENT

The intended finished application is a **harmonic observatory**: it can ingest music, describe its pitch ecology and time-varying harmonic behavior, place that music in a transposition-independent coordinate space, compare it with songs/artists/systems, alter the coordinate vector interactively, search for nearby music, analyze chord function, propose continuations under multiple competing objectives, optimize voicings geometrically, and retrieve real examples exhibiting similar behavior. Holographic Harmony remains the distinctive active/shadow representation layered into this larger system rather than being discarded.

The build strategy is deliberately staged. The current visualizer provides the event/parsing/playback/visual foundation; the next code converts those events into a versioned harmonic fingerprint; later phases add contextual function, voice leading, corpus comparison, editable Savant-style exploration, and finally an empirically grounded semantic feeling layer. Every later feature must consume the same tested fingerprint/state model so that the system grows outward from one representation instead of becoming a collection of unrelated music-theory tools.
