# HHF-3.9.5 — Shared HarmonicState/HIR and nine-block extraction

Branch: `harmonic-savant-hhf3.9.5-shared-hir`

Starting source: `df185d915fcc5fa2408572d2e1409bfeca564e28`

## Delivered behavior

Opening a symbolic score now builds an immutable `hir-1` record in the score worker. It retains canonical source events and spelling, absolute pitch classes and relative degrees, ranked center hypotheses, a declared or inferred normalization reference, reference field and exact shadow, sounding sonority windows, chord/function alternatives, and source/configuration/transformation provenance. A normalization reference is explicitly not a verified key.

The shared `harmonic-state-v1` exposes clipped duration mass, exact untied onset counts, duration-weighted bass/top pitch classes, vertical interval histograms, register/cardinality statistics, field/shadow arithmetic, inferred alternatives and ordered admissions. Sounding windows use half-open boundaries; rests remain gaps and zero-duration events remain source/attack evidence. Persistence, withdrawal and local center trajectories are not newly estimated.

The Harmonic Savant visualizer accepts the same source-checked HIR. Its existing activity kernel, adaptive collection estimator, admissions and crystallization are preserved and projected into shared live states consumed by the circle, diagnostics and admission timeline. This is an additive bridge: audio analysis and the original standalone/Observable adapter are not yet migrated. Local live fields and whole-score normalization references have distinct scopes.

The current score card has a **Harmonic analysis · nine feature blocks** disclosure with evidence descriptions and separate analysis/fingerprint JSON exports. The full analysis export contains original canonical events. Save score retains the existing compact comparison descriptor; HIR is transient and not silently added to browser storage.

Opening local audio keeps the score/catalog panel visible, retains a loaded catalog and its filters, and explains that a matching score is needed. **Load matching score** publishes the attached MusicXML's measured events and actual source-byte hash to the shared score worker, enabling catalog and saved-score comparisons while the recording and inferred audio timeline remain open. The matching-score HIR is not substituted for the audio visualizer's inferred state.

## Nine integrated blocks

The existing four foundation formulas are unchanged: pitch ecology, bass gravity, interval spectrum, and register/texture. Whole-score extraction now also connects chord vocabulary, chord transitions, root motion, modal profile and chromatic strategy. Additional pitch-dependent blocks operate relative to the HIR reference to remove absolute-pitch tie-breaking artifacts.

Transitions and root motion summarize leading inferred candidates, with alternatives retained in HIR. Modal profile is a whole-score hypothesis summary; its unavailable local center-change rate is null. Chromatic center-change precedence is also null until local trajectory evidence exists. Candidate weights are not probabilities. Seconds-based durations/rates are not claimed tempo invariant.

Expanded fingerprints use schema `1.1.0-experimental`, analysis `0.3.0-hir-nine-blocks`. This is not the full Fingerprint V1 freeze. Voice leading, temporal architecture, recurrence and the full Holographic fingerprint remain explicit null blocks.

## Compatibility and failure behavior

`deriveScoreComparisonFromHIR` reuses the HIR sonorities and complete best-supported chord cohorts, then applies the original eight score-comparison formulas. `score-comparison-v1`, foundation fingerprint `1.0.0`, local storage keys and the 500-reference PDMX catalog are unchanged. Catalog records remain legacy descriptors with null HIR provenance; this checkpoint does not retroactively claim HIR ingestion for those reference files.

If expanded extraction fails or exceeds the bounded HIR limits (20,000 events / 10,000 sounding windows), existing comparison extraction remains available with an explicit expanded-analysis error. Source generation guards reject stale worker results. JSON import validates version/shape and rebuilds derived records from canonical events/configuration before accepting them. Source records, provenance, keys and integers require exact agreement. Derived noninteger numbers allow only `64 * Number.EPSILON * max(1, abs(exported), abs(rebuilt))` rounding tolerance, and the importer returns the rebuilt evidence. This addresses JavaScript engine differences in calculated weights without accepting material changes or changing the analysis formulas/schema.

Pure HIR transposition retains source identity and spelling provenance and records its transform history. Target-key notation and the translation UI remain pending; this does not claim the constitution's full key-translation contract is finished.

## Reproduction and validation

```bash
npm ci
npm test
npm run build
node scripts/analyze-score-file.mjs score.musicxml --hir analysis.json --fingerprint fingerprint.json
node scripts/validate-hir.mjs --json validation.json score.musicxml other.mxl
```

The CLI supports the existing MusicXML/MXL/MIDI import route, hashes actual source bytes and refuses to overwrite its inputs.

- **264 automated tests passed, 0 failed.** Installation, production build and whitespace checks passed.
- Tests cover clipped timing, tie/grace attacks, rests/end boundaries, reverse seeks, changed fields, source immutability, corrupt versions/derived records, JSON round trips, stale worker/source guards and unchanged saved-record content.
- Regression controls cover browser-to-Node rounding, strict rejection of larger changes and extra/missing derived records, catalog/filter retention on audio changes, matching-score source-byte hashing and stale attachment suppression. Actual Paper Demo browser downloads pass HIR rebuild validation and expanded-fingerprint validation; the original failing export differed only in 248 derived weights, by at most `5.6e-17`.
- All twelve transpositions preserve nine normalized blocks for the chromatic demo and a symmetric diminished-seventh fixture, with supplied and independently inferred references (1e-10 tolerance). Pitch round trips recover the original registered MIDI values.
- Six private score fixtures and ten PDMX references pass exact legacy-descriptor equality, nine-block validity, canonical JSON round trips, supplied and independently inferred +5-semitone controls, MIDI pitch round trips, all available eight-metric transposition/tempo controls, live projection parity and unchanged source events/bytes. No private raw scores are included in Git or deployment.
- The largest private fixture has 3,134 notes / 1,776 windows. Initial HIR/fingerprint analysis took about 6.3 seconds here; other private fixtures about 0.9–3.0 seconds. Full hypothesis exports are verbose: the largest pretty JSON was 143,865,475 bytes. Compact/deduplicated serialization and large-score memory benchmarking remain work before a production schema freeze.
- Browser/deployment acceptance is recorded in the accompanying completion report.

## Master-plan delta

| Requirement | Progress in this checkpoint | Remaining scope |
|---|---|---|
| Shared HarmonicState / constitution HIR | Versioned immutable symbolic-score record shared by visualizer, extraction and comparison | Audio/Observable migration, local trajectories, persistence/withdrawal, compact serialization |
| HHF-002 normalization | HIR relative degrees, explicit reference and provenance; nine-block transposition controls | Full target-key spelling/translation UX |
| HHF-003 windows | Shared sounding-sonority and global states, timing/gap controls | Phrase, field-duration and sectional state integration |
| HHF-008 schema/export | Expanded whole-score extraction and browser/CLI exports | All thirteen blocks and final V1 freeze |
| HHF-012/013/014 | Existing contextual function, root-motion and transition modules integrated | Stronger empirical validation and ambiguity-aware summary policies |
| HHF-015/016 | Modal ambiguity summary and field-relative chromatic strategy integrated | Local trajectory/change-conditioned behavior |
| HHF-028 full V1 | Four to nine integrated blocks | Voice leading, temporal architecture, recurrence, Holographic block |
| HHF-033/034/035/036 | Current query can project from HIR without changing catalog distances | HIR-native reference regeneration, broader corpus and passage search |
| HHF-056/058/059 | Version/shape guards, storage compatibility, bounded acceptance and provenance | Production migration policy and broader browser/mobile/performance coverage |

This is an incremental comparison with the master plan, not a fresh completion-count audit of all sixty tasks. Full canonical corpus search, personal/artist aggregates, passage indexes, empirical semantic retrieval and all accepted constitution goals remain in scope. The next architectural checkpoint is local/sectional trajectories and temporal/Holographic measurements, feeding the four remaining fingerprint blocks.

Rollback to source `df185d9` / checkpoint 3.9.4. No source-score rewrite or browser-storage migration is required.
