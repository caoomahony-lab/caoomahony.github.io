# HHF-3.9.4 — PDMX reference comparison pilot

Branch: `harmonic-savant-hhf3.9.4-reference-catalog`

Starting source: `77889606ac6a5cfbcc996a43234ab79089577564`

## Delivered behavior

The existing score-comparison panel now includes a lazy-loaded **Reference music — PDMX pilot** section. Load the catalog, optionally filter by title/composer/tag, genre and source instrument label, then compare the current score with external reference scores. The first result expands automatically; other leading results reveal the same eight-component table, transposition, explanations and pitch overlay. Catalog results export as versioned JSON.

The browser downloads public reference metadata and fingerprint shards. User score bytes, canonical events and search terms are processed locally and are not included in network requests. The saved-score/audio libraries remain separate and keep their existing versions. Switching scores or filters invalidates stale catalog results.

## Data and reproducibility

Source: PDMX v9, DOI `10.5281/zenodo.15571083`, https://zenodo.org/records/15571083.

Attribution: Phillip Long, Zachary Novack, Julian McAuley and Taylor Berg-Kirkpatrick. Dataset metadata is published under CC BY 4.0; individual scores carry the source's public-domain labels. The pilot requires the source's `no_license_conflict`, `all_valid` and `deduplicated` flags, a public-domain label, and excludes drafts. It initially selects scores with 48–1000 metadata notes and 10–300 metadata seconds, then requires measured polyphonic interval evidence, at least three attacks and 4–500 sounding regions.

The 225,399,738-byte source CSV is verified against its pinned MD5, `30392ccf38bb63ce70e7afae70f9c88c`. The MXL archive is streamed until 1,100 eligible candidate files are acquired. The full archive is not downloaded or claimed checksum-verified; each selected MXL retains its actual SHA-256 and original archive path. Raw source scores remain outside Git and deployment.

Of 1,100 candidates, 647 passed the analysis bounds and 453 were rejected (452 outside the pilot bounds; one inconsistent canonical event set). The first 500 successful unique source hashes in archive order form the published pilot. This selection is reproducible but biased: 410 records carry a classical label, 29 a folk label, and some have no genre. It is not representative of all PDMX or popular recordings. Instrument names and composer fields are source metadata, not a standardized instrument taxonomy or verified recording credits.

`public/catalog/pdmx-v9/manifest.json` holds metadata and the six distribution projections. Twenty checksum-identified shards hold all eight comparison descriptor fields for 25 records each. The duplicate foundation-fingerprint body is omitted from the shard projection; comparison semantics are unchanged. Every record preserves source identity, rights labels, parser/analysis version and an explicitly null HIR schema version.

Reproduce:

```bash
python3 scripts/acquire-pdmx-pilot.py /private/pdmx-cache --count 1100
node scripts/build-pdmx-catalog.mjs /private/pdmx-cache/selection.json public/catalog/pdmx-v9 /private/pdmx-validation.json
npm ci
npm test
npm run build
```

## Search semantics

The default is **pitch content**. All filtered records are scored for the selected distribution feature (pitch, bass, vertical intervals, upper-note proxy, attack rhythm or sonority durations). The leading 20 receive full eight-component comparisons; up to five results are displayed. Missing evidence is counted separately and is not a zero-distance match.

Sonority-order and chord-candidate-order queries first select the leading 20 pitch-content records, then rerank those by the requested order metric. The UI and export explicitly identify this shortlist scope; it is not guaranteed to find the order-nearest piece across the entire catalog. Detailed comparisons use the existing 48-million-cell whole-order limit and retain explicit unavailable results.

All detailed pitch-dependent components use one declared shift selected by the requested ranking feature. The distribution projection is tested to agree exactly with the corresponding full comparison. Exact source identities remain eligible catalog matches. There is no aggregate similarity percentage, recording-match claim, artist-style aggregate or matched-passage search.

## Verification

- **249 automated tests passed, 0 failed**; dependency installation, production build and whitespace checks passed.
- All 500 selected records pass self-comparison and retain unchanged source bytes/events.
- Ten references spread across the pilot pass +5-semitone and duration ×2 controls within 1e-12 for every available component.
- All 500 shipped descriptor records agree with their manifest summaries, source hashes, counts and checksum-verified shards.
- All six private score fixtures pass both pitch-content and order-shortlist queries: 12 queries, 20 detailed candidates each, no unavailable primary distance in these queries; input files remain unchanged. Slowest measured query about 739 ms in this runtime, excluding initial derivation/download.
- Browser and deployment acceptance are recorded in the accompanying user completion report. Private validation reports and input scores stay outside Git.

## Master-plan position and rollback

This checkpoint advances HHF-035/036 (external corpus records and ingestion), HHF-033/034 (search/comparison), and HHF-046 (metadata filters). These are capabilities of a bounded experimental pilot, not completion of full canonical corpus search. The constitution's HIR requirement remains explicit: no large-scale authoritative search claim is made. The shared HarmonicState/HIR, full fingerprint pipeline, temporal/Holographic blocks, personal/artist aggregates, passage indexes and empirical semantic layer remain accepted goals.

Storage versions for saved user scores/audio are unchanged. Catalog schema is `reference-catalog-v1`, catalog ID `pdmx-v9-pilot-500-v1`, analysis `score-comparison-v1`; incompatible or corrupt catalogs require regeneration rather than silent reinterpretation. Roll back by serving source/preview `7788960`; no user-file rewriting or storage migration is required.
