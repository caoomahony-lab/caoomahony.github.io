# Harmonic Savant — HHF-019 Accepted Checkpoint

Status: **ACCEPTED / CHECKPOINTED**  
Branch: `harmonic-savant-v0.2-core`  
Ticket: **HHF-019 — Candidate Chord Generator**

Implemented in `src/continuation/candidate-generator.js` with tests in `tests/candidate-generator.test.js`.

The generator produces possible harmonic continuations with explicit provenance from:

- diatonic tertian triads/sevenths;
- secondary dominants;
- parallel modal mixture;
- chromatic mediants relative to the current root;
- optional Holographic active/shadow-field candidates;
- injected corpus-observed candidates;
- injected user-style candidates;
- generic external candidates.

Duplicate harmonic objects merge provenance rather than appearing multiple times. Holographic candidates explicitly report retained active-field pitch classes and admitted shadow pitch classes. External evidence is labeled by source and validated.

The generator deliberately does **not** assign a universal score, probability, or best next chord. It generates the search space. HHF-020 scores independent objectives and HHF-021 combines only the objectives the user chooses.

Acceptance run:

```text
Commit: d5314e95b859a9e3ceeaf4cbea9124eb11cfa0c1
Tests/build: PASS on full Harmonic Savant CI branch gate
```

Scope boundary: corpus/style entries are injectable evidence only; no proprietary or fabricated corpus is bundled. Candidate generation is not a claim that every generated chord is stylistically appropriate in every musical language.
