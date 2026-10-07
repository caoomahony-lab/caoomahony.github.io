# HHF-3.9.1 — Evidence coverage and ordered-harmony audit

Branch: `harmonic-savant-hhf3.9.1-similarity-audit`  
Starting source: `438dcde2a1f25f7d49f1a36688e641f8466dea84`  
Status: **IMPLEMENTED / TESTED; experimental, not a calibrated musical-similarity model**

## Problem and reproduced evidence

The HHF-3.9 summary model distinguishes several broad musical statistics, but it does not preserve the whole chord sequence. The following two deterministic examples have the same chord inventory, transition counts, recurrence signature, durations, chroma, descriptive profile, and registered top-line proxy:

```text
C D E C G B C
C G B C D E C
```

Every chord is major, lasts one second, and has the same held high C above its lower triad. Their original summary distance is **0**. That is equality under the recorded summaries, not identical musical ordering. The new separate chord-order diagnostic reports **4 edits / 7 regions = 0.5714285714285714**.

Missing evidence caused a second problem. Comparing two empty original descriptors produced structure index **100**, even though neither contained a chord. The audit reports `NO_SHARED_EVIDENCE`, null distances and unavailable family indices instead.

These are reproducible implementation counterexamples. They do not establish how human listeners rank different compositions, or explain every previously reported high score.

## Additive implementation

`src/similarity/pairwise-distance.js` remains unchanged. Its descriptor, component formulas, family weights and original comparison remain available through **Original HHF-3.9** in the browser selector. The accepted fingerprint schema, musical theories, parsers, transposition engine and continuation algorithms are unchanged.

The additional module is `src/similarity/evidence-aware-distance.js`, version `pairwise-evidence-audit-v1`. On this experimental branch, the browser also offers **Evidence-aware (experimental)**. New saved fingerprints retain both `descriptor` and `auditDescriptor`.

The audit uses the existing weighted summary architecture, with explicit unavailable evidence:

| Component | Required evidence in both pieces |
|---|---|
| Motif | Nonempty top-line motif counts |
| Interval | Nonempty registered top-line interval counts |
| Relative rhythm | Nonempty relative-IOI-ratio counts |
| Harmonic transitions | Timed, fully labeled chord regions and at least one transition |
| Recurrence | Timed, fully labeled regions and at least one supported lag |
| Region duration | Explicit positive duration/end and known onset |
| Tonal profile | Twelve finite nonnegative chroma values with nonzero mass |
| Descriptive profile | Six supported, finite dimensions in `[0,1]` |

A component missing from either side is unavailable, not zero distance or maximum distance. Remaining summary weights are renormalized using the original HHF-3.9 weights. Partial comparisons display their **available components / 8** and list unavailable components. Thus partial scores do not have the same evidential scope as complete scores.

Recurrence uses only lags supported by both region sequences, up to the original limit of eight. Unsupported lag positions no longer contribute matching placeholder zeros. Numerical zeros remain valid when actually observed. Invalid MIDI/onset records, including null pitches previously cast to MIDI 0, are rejected with an explicit count.

The audio explorer supplies upstream feature-availability flags so default six-bar values do not masquerade as measured profile dimensions. The six existing descriptive bars themselves are retained.

## Chord-order definition

The separate ordered diagnostic is normalized unit-cost Levenshtein edit distance between the complete timed sequences of `(root pitch class, chord family)`. It minimizes over twelve **single global transpositions** of the saved piece:

```text
ordered distance = minimum edit count over 12 transpositions / max(region counts)
```

Insertion, deletion and substitution each cost one. The result reports both region counts, edit count and the semitone shift from saved piece to current piece. Equal minima choose the smallest shift deterministically. This comparison is symmetric and bounded between 0 and 1; no triangle-inequality or perceptual-metric claim is made.

Unknown root, chord family or region timing makes ordered harmony unavailable. Unknown regions are not removed to manufacture transitions across gaps. A three-million-cell-update budget bounds nonmatching sequence comparisons; oversized comparisons return `COMPUTE_LIMIT` rather than a truncated score. Exact transposed copies can still be checked in linear time.

**Order is not inserted into the aggregate score or used to rerank neighbors.** Choosing its musical importance requires representative real-piece validation. The browser explicitly shows summary distance and chord-order distance separately.

## Corpus percentiles and migration

Experimental percentiles require at least ten saved-library baseline pairs with the same available-component signature as the query, including the supported recurrence-lag count. Mixed-evidence pair distances are excluded. The displayed pair count is the actual denominator; a percentile remains relative to that library and is not a probability of shared music.

Existing browser records are preserved. Records without the new versioned audit descriptor remain available in the original method. The experimental method asks the user to re-analyze and explicitly save them. No old vector is silently reinterpreted, and switching methods does not write storage.

## Verification

Initial full suite: **191 tests, 190 passed, 1 failed**. The existing chromatic progression test expected XML chord-note order, while the established parser returns simultaneous notes sorted by pitch class. Only the two expected triad arrays were corrected; the parser, score fixture, pitches and timing were not changed.

After implementation: **207 tests, 207 passed, 0 failed**. Sixteen new tests cover absent/one-sided evidence, measured zeros, full-support parity, supported recurrence lags, transposition/tempo invariance, an exact ordering counterexample, symmetry/bounds, unknown labels/timing, invalid notes, version migration, compatible-evidence percentiles, computation limits, determinism/immutability, and upstream fallback bars.

`npm run build` passed. All **58** checked static assets and transitive module imports returned successfully from the built site; the served audit module matched the source exactly. JavaScript syntax and `git diff --check` passed.

Eight additional DOM integration checks passed using a temporary JSDOM 26.1.0 installation outside the repository: order-diagnostic rendering, original summary preservation, local save persistence, legacy migration warning, original-method availability, storage preservation while switching methods, restoration of the audit view, and refusing to rank empty evidence. No application dependency was added.

**Native browser acceptance remains unexecuted.** Playwright was available, but its Chromium executable was absent. The download endpoint returned a 195-byte HTML response rather than a browser archive. Consequently, actual audio upload/decoding, browser console behavior, and phone/desktop visual layout were not verified in this run. DOM checks do not substitute for those checks, and production deployment was not changed.

## Remaining limits and next gate

Registered top-line extraction remains the highest note within a 0.09-second attack group. It is not verified melody transcription. Inferred chord labels may also be wrong or incomplete. Root/family sequence equality does not establish identical voice leading, function, rhythm, texture, form, or listener experience.

This change meets deterministic implementation checks, not the constitution's representative-real-file replacement gate. Both methods are retained; this branch should remain experimental until user-selected real musical pairs validate discrimination and retrieval behavior. Rollback consists of selecting the original method or reverting this additive branch.

The next focused task is to validate both views on a small, explicitly labeled set of user-owned scores: transposed copies, rearranged passages, related compositions, and deliberately contrasting harmonic organizations. Use authoritative score notes to separate comparison failures from audio-transcription failures before choosing any new composite weights.
