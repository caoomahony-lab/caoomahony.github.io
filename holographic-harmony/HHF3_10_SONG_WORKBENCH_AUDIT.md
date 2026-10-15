# HHF-3.10 — song workbench and reliability audit

Audit dates: 2026-10-14–15 (UTC). Baseline: c186defcaede36a100deaca02780c23b8973e57f (264 tests). Final automated checkpoint: 295 tests passed, static build passed.

The final production audio check exposed a floating-point overlap at shared region boundaries. Region lookup now chooses the latest onset at or before the selected time, then verifies the region end. The regression uses the observed eight audio regions and preserves genuine short rests without an epsilon or smoothing.

## Problems corrected

| Finding | Result |
| --- | --- |
| Bottom continuation input displayed an unrelated canned progression | Song mode uses the same score/audio regions as the visualizer. Manual progression remains an explicit mode. |
| No chord selector connected to continuation | A labeled slider and numbered chord buttons select and seek the song. Playback follows the same half-open sounding intervals. |
| Score timeline buttons disabled | Score regions can be selected even when no audio is available. |
| Silence inherited the first/last chord | Rest intervals and the final endpoint show no sounding chord. History stops at rests or unresolved readings. |
| Next-chord choices had no second step | Each suggestion expands into three hypothetical continuations. Actual next-in-song is labeled separately. |
| Synchronous continuation work could interrupt playback | A cancellable local module worker computes bounded candidate/voicing searches. Stale source/selection results are discarded. |
| Candidate cap could exclude later source families | Workbench permits up to 192 candidates; scores and existing theory are unchanged. |
| Uncalibrated continuation scores resembled percentages | Scores are labeled indices out of 100. Corpus/style stay unavailable without evidence. Invalid numeric evidence is rejected. |
| Superseded requests could change current song/reference state | Song-load errors and matching-score requests have independent generation guards. |
| Corrupt audio-library storage could break startup; quota errors looked saved | Stored record shape is checked and write failures are explicit, with rollback. Source hashes distinguish same-title audio files. |
| MXL relied on ZIP headers to bound expansion | Stream output is bounded while reading; declared sizes and header bounds are validated. |
| Fatal initialization error rendered as HTML | Error text is rendered through textContent. |
| Unhandled playback rejection | Playback failure is caught and shown while timeline exploration remains available. |
| Transient filesystem error could fail clean build | Static distribution cleanup retries bounded filesystem failures. |
| Manual edits or option changes left old worker results visible | Edits cancel pending work, clear stale exports and require updated analysis. Failed workers and timed-out requests release the busy state. |
| A pinned chord could inherit the field from another playback moment | Field snapshots must match the song generation and selected sounding interval; otherwise that evidence is unavailable. |
| Hypothetical branches mixed old progression with newly edited settings | Branches reuse the completed session's explicit settings and label declared/inferred context correctly. |
| Corrupt/full annotation stores could silently lose personal notes | Existing notes are preserved; unsupported data and capacity errors block overwriting. |
| Saved score records could be silently discarded on the next save | Unreadable score-library data blocks overwrite. Valid audio records remain usable while unreadable audio records are preserved. |
| Cancelled decodes continued into stale PCM processing | Abort signals close the decoder and stop pending reads/decode before stale analysis starts. An already-running synchronous PCM loop remains a performance limit. |
| Unsupported imports mixed an error badge with the previous playing song | The current song is explicitly retained; failed requests do not replace it. |
| Composer filter and persistent catalog preferences missing | Explicit composer filtering is combined with search/genre/instrument; preferences survive reloads when browser storage is available. |

## Finished useful features

`song-progression-v1` is a presentation adapter, not a replacement inference engine. It carries source identity, generation, timing, chord alternatives and measured/inferred provenance. Continuation uses at most sixteen contiguous resolved regions through the selection; future song chords are never used as prior history.

The original chromatic eight-chord fixture remains the regression input. Score voicing is taken from sounding registered notes when available (up to six notes); audio voicing is not invented. Pinned chord analysis retains its selected active/shadow snapshot while playback continues.

Five short, source-attributed popular-song chord skeletons provide local ordered matching under a single transposition. Matching ignores extensions, inversions, timing and repeated holds, requires at least three ordered chords, and stops at unknown labels/rests. A same-root major/minor device is explicitly weaker than an identical progression, including its direction. This small curated set is separate from the existing 500-score PDMX reference catalog.

Source-page mood descriptors stay attached to their reference, with subjective provenance and no claim that they predict a listener's emotions. Personal feeling notes carry the song hash/demo identity, chord interval, rater type and timestamp; they are saved on the device and can be exported as JSON. No music or personal annotations are uploaded by these features.

## Preserved capabilities

Canonical active/shadow geometry, score/audio inference, nine HIR fingerprint blocks, all eight score distances, transposition matching, imports, local score saving, the 500-score catalog and its source provenance, functional translation, explicit ranking presets, closest voicing display, exports, legacy research comparison and the Observable adapter remain available. No user-owned library records are intentionally deleted by this upgrade.

## Master-plan status and limits

| Master-plan item | Status after this checkpoint |
| --- | --- |
| Stable app shell and catalog/source switching | Existing shell retained; stale requests guarded and browser regression required. |
| One representation across score views | Existing score HIR reused. Audio remains an explicitly inferred adapter; full cross-source HIR migration is pending. |
| Song-linked continuation and second-step exploration | Implemented, bounded and local; suggestions are hypothetical, not edits to the imported song. |
| Explainable comparison | Existing eight metrics preserved. No new combined whole-song similarity score. |
| Reference subsystem | Existing 500-score pilot preserved; five curated popular progression references added with sources. Large licensed popular-song corpus remains pending. |
| Feeling layer | Personal annotations and source-reported descriptors implemented. Empirically calibrated feeling prediction/search remains pending. |
| Complete fingerprint | Nine integrated blocks remain; four planned blocks and calibrated combined ranking remain pending. |
| Temporal/passages | Synchronized chord selection and bounded history added. Arbitrary passage matching, phrase fingerprints and trajectory search remain pending. |
| Production acceptance | Automated checks, staged browser verification, production commit marker and alias verification recorded in the accompanying release report. |

This checkpoint does not claim a full transcription engine, learned style recommendation, streaming-service catalog, or a completed master plan. Recommendations retain the existing explicit objectives and missing-data policy.

Browser acceptance uses public generated audio and MusicXML fixtures, never private compositions. A true phone viewport is not exposed by the available browser controls; responsive CSS is reviewed, but phone-device acceptance must not be claimed from the desktop run. Catalog metadata encoding/attribution is retained from the pinned public source and is not silently rewritten as verified recording identity.
