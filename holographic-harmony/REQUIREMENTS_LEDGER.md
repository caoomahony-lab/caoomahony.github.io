# Holographic Harmony — requirements ledger

Authoritative current status ledger. Governing goals remain PROJECT_CONSTITUTION.md and HARMONIC_SAVANT_MASTER_PLAN.md. Historical checkpoints retain their dates; this file records current acceptance without replacing those goals.

## Reproducible baseline · 2026-10-19

- Repository: `caoomahony-lab/caoomahony.github.io`, app `holographic-harmony/`.
- Baseline development reference: `harmonic-savant-hhf3.10-song-workbench` at `1822c8d2282e6209d5f294fe0bf7b2733b30758e`.
- Production alias at the start of this checkpoint: `harmonic-savant-hhf3.vercel.app` → `dpl_kygV937v7pZcJccVUD1NzRzbXHZ3`, READY; recorded implementation `504b492ec6bc980015f354befcaf044cf58d254d`.
- Accessible snapshot has full tree `deb932e3466efe6a19592494028b8090eceaf9ea`, identical to the deployed source tree established in the saved release audit. Deployment contents/source marker will be rechecked before release.
- Entry: index.html → src/main.js → HarmonicSavantApp → CollectionAwareHolographicHarmonyApp. Static ES modules; Node24 build; Vercel root holographic-harmony, bash deploy-build.sh, output dist.
- Reproduced npm ci, all295 tests, npm run build. Local branch `harmonic-savant-hhf3.11-composition-lab` preserves the reference and main.
- Saved schemas: score-comparison-v1 compact records; legacy audio descriptive/evidence-aware records; feeling-observation-v1; catalog preferences. No migration is implicit.

Status: **verified** = relevant current deterministic/browser evidence; **defective** = reproduced behavior violates a contract; **missing** = accepted capability absent; **experimental** = implemented but validation/integration insufficient; **blocked** = required evidence or environment unavailable. A status applies only to the stated scope.

## Requirements and acceptance

| ID / priority | Accepted capability and user location | Implementation / evidence | Status / remaining acceptance |
|---|---|---|---|
| B01 P0 | Reproducible source/build identity | Git tree, source marker, deployment API; npm ci/test/build | verified baseline; HHF-3.11 release identifiers recorded in release handoff after final deployment |
| B02 P0 | One shell across catalog and imports | HarmonicSavantApp; audio-catalog-flow tests; Chrome catalog→score/audio switching | verified tested desktop flow; no navigation to another app; true phone acceptance open |
| B03 P0 | Failed import retains previous usable composition | captureLoadSession/recoverLoadFailure; import-recovery and panel-recovery tests; malformed XML browser import | verified scoped recovery, registered source/clock/export restoration; late errors cannot restore over newer sources |
| B04 P0 | A→B→A isolation, canceled/stale workers | generation guards, deferred score commit, reset rendered clock; local-audio/audio-worker/import-recovery tests | verified deterministic controls; final-build A→B→A and malformed-import recovery browser replay passed |
| B05 P0 | Storage quota/corruption preserves records | score-library-preservation, song-workbench tests | verified scoped failures; unfamiliar records cannot be rewritten |
| B06 P0 | Full backup and non-destructive restoration | workspace-backup model/panel; four preservation/rollback tests; browser download and unchanged-record restore | verified app-record backup; original music excluded; conflicts refused; quota rollback tested |
| B07 P0 | Bounded untrusted inputs/archives | score-io/MXL bounds; 64MiB audio, decoded sample limits; abortable module audio worker; malformed-input tests | verified stated budgets and cancellation; decoding allocation occurs before decoded-size rejection |
| M01 P0 | Exact active/shadow partition and admissions | theory/fields, admissions; harmonic-state | verified canonical tests; unchanged formulas |
| M02 P1 | Shared symbolic event/HIR with spelling/voices/provenance | model/events, harmonic-ir; harmonic-ir tests | verified symbolic subset; audio/Observable full migration missing |
| M03 P1 | Consistent selected source/interval in panels | song-progression, composition-context and report contracts; pinned passage and playback disclosures | experimental passage integration; whole-piece comparison stays explicitly whole-piece; full audio HIR remains open |
| M04 P1 | Reversible interpretation edits and edit history | alternate reading affects transient sketch | missing persistent revision history |
| M05 P0 | Actual song-linked progression/selection | song-workbench boundary tests | verified baseline; audio chord labels remain inferred |
| M06 P1 | Score/performance alignment, tempo/repeats/pickups | validation/local-timing-alignment | experimental; alignment validation only, not playback remapping |
| M07 P1 | Alternate roots/functions/centers retained | HIR candidates, function-engine | verified deterministic candidate output; musical evaluation experimental |
| C01 P1 | Composition-context continuation | composition-context/composition-score; root-motion recurrence, opening return, collection, duration and optional registered evidence | experimental explicit heuristics; full motifs, texture and verified sectional roles missing |
| C02 P1 | Continue/Develop/Contrast/Return/Modulate intentions | five operational definitions and different component weights in composition-score; UI intention selector | experimental; distinct rankings tested; musical usefulness not established |
| C03 P1 | Compose-forward vs analyze/reharmonize | explicit context selector; prefix-only evidence; changed-future negative control across five intentions | verified no-future-leakage fixture for present context; analysis mode discloses whole-composition information |
| C04 P1 | Two subsequent hypothetical steps | SongContinuationPanel branch expansion X→Y→Z; browser Gm→Daug→Bm path | verified generated three-chord branch navigation; original composition retained |
| C05 P1 | Separate function/voice/field/novelty/style reasoning | continuation/session, rank, scores | verified scoped rules; corpus/style unavailable without evidence |
| C06 P1 | Generated constrained voicings and audition | voicing-enumerator, declared piano MIDI bounds, separate WebAudio audition; browser original pauses for generated sound | verified stated piano preview controls; other instrument-specific constraints and listener validation missing |
| C07 P1 | Paired-context comparison to local baseline | composition-context tests: same final chord/different histories; local method selectable; per-component explanations | experimental; contextual ranking differences verified, no held-out usefulness gain established |
| F01 P1 | Nine integrated existing fingerprint blocks | fingerprint/hir-extract; harmonic-ir tests | experimental schema1.1.0; original formulas retained |
| F02 P1 | Voice-leading fingerprint | existing distance engine, null HIR block | missing integrated block |
| F03 P1 | Temporal/sectional trajectories and return/departure | null HIR temporal block | missing |
| F04 P1 | Recurrence/motif fingerprint | audio proxies; null canonical block | missing canonical integration |
| F05 P1 | Full Holographic fingerprint/persistence/withdrawal | live kernels; null HIR block | missing fingerprint contract/integration |
| F06 P1 | Full FingerprintV1 freeze and invariances | nine-block experimental schema | missing; cannot freeze by filling nulls without validation |
| S01 P1 | Decomposed key-independent whole-piece comparison | eight score metrics + legacy audio | verified scoped transformation controls; methods experimental |
| S02 P1 | Order negatives, missing-data/scope integrity | score-similarity-audit/evidence-aware tests | verified deterministic negatives; held-out real-user evaluation blocked |
| S03 P1 | Passage→passage/progression search with locations | composition-context compare/search in worker; current song and up to64 saved passages; exact offsets/alignment | experimental bounded equal-region-count search; catalog descriptors cannot support arbitrary passage matches |
| S04 P2 | Holographic-trajectory search | no trajectory index | missing |
| S05 P2 | Reference corpus with reproducible provenance |500PDMX descriptors; reference-catalog-data tests | experimental; HIR-native regeneration/opening scores missing |
| S06 P2 | Personal aggregate, variation/evolution/clusters | saved score/audio libraries | missing shared traceable aggregate |
| S07 P2 | Composer/artist comparisons | metadata filters and piece comparisons | experimental; no supported artist aggregate identities |
| S08 P2 | Synthetic harmonic-coordinate query and explanation | six audio descriptive sliders only | experimental; canonical harmonic sliders missing |
| T01 P1 | Target-key translation and explanation views | connected function/session renderers; passage context target selector and export | experimental functional root/template view; slash-bass, registered voicing and full score rewrite not implemented |
| T02 P1 | JSON/CSV/text/Markdown exports and restoration | composition-export, workspace-backup; stale-selection/CSV-safety tests; browser JSON inspected outside app | verified scoped passage reports and exact app-record restore; full transformed score round trips remain open |
| T03 P2 | Transformed MusicXML/MIDI with round trips/loss report | original-score/MIDI→MusicXML projection | missing full key transformation exports |
| E01 P2 | Personal/source/theory/empirical descriptions separate | feeling-notes, five sourced references | verified annotation provenance; no calibrated prediction |
| E02 P2 | Descriptor→examples and music→tags | composition-workbench searches saved personal observations or attributed reference tags; source/time linked | verified annotation-only retrieval in browser; no validated language-to-harmony predictor |
| E03 P2 | Empirical learned associations with held-out evaluation | no adequate tagged dataset | blocked; do not call annotation retrieval a learned model |
| U01 P1 | Source/time/selection/mode/evidence always clear | workbench headers, pinned passage, mode disclosure, measured/inferred/generated labels | verified scoped desktop interactions; full accessibility/phone acceptance open |
| U02 P1 | Narrow portrait/landscape/touch/keyboard | responsive CSS, desktop controls | blocked actual phone viewport/device acceptance |
| U03 P1 | Bounded page/circle/timeline sizes | existing bounded circle/timelines plus440px passage results and220px alignment scroller | experimental; no horizontal overflow at1348×936 desktop; actual phone viewport checks blocked |
| U04 P1 | Performance budgets, cancellation, cleanup | audio worker abort/timeout tests; named eight-region Node benchmark; explicit region/event/search/file limits | experimental; fixture budgets met, repeated-load memory profiling and phone performance unverified |
| R01 P0 | Independent acceptance families, held-out controls |317 passing tests, build; transformation/negative/failure-recovery controls; three authorized scores checked locally | experimental overall; no held-out perceptual/retrieval calibration or full musical-context acceptance |
| R02 P0 | Clean artifacts/private material excluded | tracked-file review; public fixtures only in deployment; private validation outside repository | verified HHF-3.11 changed-file and235-file manifest review; private fixtures/results excluded |
| R03 P0 | Preview→production identity/asset check/rollback | staged existing Vercel project; preserve HHF-3.10 dpl_kygV937v7pZcJccVUD1NzRzbXHZ3 | verified final production alias, source marker and app.js bytes; preserved rollback; no schema replacement |
| R04 P1 | One current status and concise reproducible handoff | this ledger; WORK_START_HERE points here; one HHF-3.11 release report | verified ledger and saved HHF-3.11 release report with identifiers, reproduction, measured limits and rollback |

## Execution slice and budgets

Dependency order is safety → selected evidence → composition-context exploration → passage comparisons/export → preview acceptance. Implement additive experimental methods beside the unchanged local-chord baseline and existing distance/fingerprint formulas. Broader research remains open if it lacks acceptance evidence.

Initial performance budgets in this environment: existing295-test suite under15s; baseline chromatic8-region context/selection and passage search under100ms each at128query/2048target regions; local workbench worker under5s for bundled8chord fixture with existing candidate/voicing caps; profile/export bounded at20000source events/2048passage tokens and20MiB backup. Report measurements rather than assuming budgets passed. No private score/annotations are committed.

## HHF-3.11 checkpoint evidence · 2026-10-19

This is a connected experimental release checkpoint, not completion of the product. No existing canonical theory, fingerprint or similarity method was replaced. The four null HIR blocks remain null. Original libraries and annotation schemas retain their versions; passage-library-v1 and composition report/context schemas are additive.

Reproduction: `cd holographic-harmony && npm ci && npm test && npm run build`. Latest full local run:317 passed,0 failed,0 skipped,2.806s (Node24). Baseline was295. Relevant new tests cover previous-source recovery, overlapping failure panel restoration, source clock reset, backup exact-byte preservation/conflicts/quota rollback, prefix-only composition context, five intention behaviors, transposition/tempo/order/rest controls, report evidence/CSV escaping, and terminating abandoned audio workers.

Chrome1348×936 preview interactions: load the public chromatic fixture, seek last chord, select passage1–3, Develop, expand Gm→Daug→Bm, audition generated notes while original pauses, compare three non-overlapping windows with transposition and source locations, save passage, translate functions to E-flat, export/inspect JSON, reject malformed XML while restoring the prior usable source, load the500-reference catalog then open WAV without losing catalog, download workspace backup and restore identical records, save/retrieve a source-linked personal description. Actual phone portrait/landscape and repeated-load memory measurements are not established by these desktop checks.

Named fixture benchmark, public eight-region chromatic score, Node24 on this executor: harmonic inference46.2ms, context1.98ms, continuation40.83ms, passage search1.05ms. Budgets100ms context/search and5s continuation passed on this fixture only. Three authorized original compositions were parsed and checked locally for exact self-comparison and evidence consistency; private files/results remain outside Git and deployment. These were not a held-out perceptual retrieval evaluation and were not used to tune rankings.

Open completion gates: four HIR fingerprint blocks; full audio/Observable HIR adapters and fingerprint freeze; persistent reversible correction history; validated performance/score alignment including difficult repeat/pickup cases; verified motif/form/instrument-aware continuation usefulness; HIR-native reference and trajectory indices; personal/artist aggregates and synthetic harmonic query coordinates; full target-key musical transformation exports; independently evaluated feeling associations; phone accessibility/performance and repeated-load memory acceptance. Annotation search and harmonic heuristics do not satisfy the research gates.

Backup/rollback: use “Back up or restore saved work” before changing browser origins; keep originals separately. Restore refuses conflicting existing records instead of deleting or overwriting them. Older HHF-3.10 ignores the new passage key and does not migrate it. Roll back the existing project to the preserved HHF-3.10 deployment if release checks fail; do not clear local storage.

## Published checkpoint verification

HHF-3.11 production alias now resolves to dpl_CCP8MWS3CZDcTYkTJjpT5mJb9eK4. Tested runtime source77b3b936f9cc2e5af525e4a16fb6c483ae2d1400 has accessible identical-tree snapshotf655a4c50aeb7ad5089ad82fa7374001569875d6; full tree6eb3d9944aedbb611dffedc27628a37c030f4588. Production source marker and app.js bytes match. The public Chrome walkthrough reproduced passage1–3, Develop, Gm→Daug→Bm, source-aligned passage comparison, inspectable inputs and JSON export (9events,3comparisons). Browser worker315ms; viewport1348×936, content width1348; no captured application-origin console errors. This ledger-only follow-up records release evidence and does not change runtime/build inputs. Whole-product acceptance and phone gates above remain open.
