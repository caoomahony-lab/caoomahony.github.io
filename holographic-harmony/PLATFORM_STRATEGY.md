# Harmonic Savant — Platform Strategy

Status: **Current recommended deployment/platform architecture**  
Date: 2026-09-16  
Authority: subordinate to `PROJECT_CONSTITUTION.md`; may be replaced only through the constitution's better-way gate.

## Executive recommendation

The best long-term platform is **not one vendor product**. The recommended architecture is:

```text
GitHub
canonical source / schemas / tests / history
        ↓
platform-independent web analysis core
JavaScript/TypeScript modules + Web Workers where useful
        ↓
local-first browser/PWA application
user MusicXML/MIDI processed locally by default
        ↓
optional cloud services
Cloudflare Workers + D1 + R2
        ↓
companion surfaces
Observable Framework for analytical dashboards / published explorations
Tauri later for desktop/mobile wrappers from the same web frontend
```

This arrangement best preserves the project's requirements: no subscription lock-in for personal analysis, cross-platform access, open exports, user-owned files, strong visualization, eventual large-corpus search, and the ability to move hosts later.

## 1. Canonical application platform: browser/PWA

The canonical user application should be an ordinary standards-based web application that can also become a Progressive Web App.

Why:

- one codebase runs on desktop and mobile browsers;
- user-supplied MusicXML/MIDI can be analyzed client-side without mandatory upload;
- heavy symbolic feature extraction can be moved into Web Workers;
- local persistence can use standard browser storage with graceful fallbacks;
- the same core can be embedded in Observable or wrapped by native shells later;
- deployment can move among static or serverless hosts without rewriting music theory;
- exporting JSON, CSV, text, MusicXML, MIDI, and reports is natural in a browser application.

The web app should not depend on one host's proprietary runtime for canonical analysis.

## 2. Source of truth: GitHub

GitHub remains the canonical source location for:

- domain code;
- schemas;
- tests;
- project constitution;
- master plan;
- benchmark fixtures;
- migration scripts;
- deployment adapters;
- release tags and provenance.

Production hosts deploy from GitHub; they do not become alternate source trees.

## 3. Recommended production host/backend: Cloudflare Workers

For the mature public application, Cloudflare Workers is the current leading host/backend recommendation.

Reasons:

- Cloudflare currently recommends Workers as its primary platform for new application projects, with a broader feature set than Pages;
- static assets can be served alongside Worker application logic;
- optional serverless APIs can support corpus search, shared fingerprints, metadata and authentication later without requiring a permanently running server;
- D1 supplies managed SQL with SQLite semantics;
- R2 supplies object storage for optional larger assets/corpus files;
- the free tiers are sufficient for development and early personal use if client-side computation remains the default;
- keeping heavy fingerprint extraction in the browser reduces server CPU dependence and protects private source files.

Current official references:

- https://developers.cloudflare.com/pages/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/
- https://developers.cloudflare.com/r2/

### Important Cloudflare constraints

Current free-tier limits are not architectural guarantees. They may change.

As of this strategy date, official documentation reports limitations including daily free Worker request quotas and free-tier D1 read/write quotas. Large static assets also have per-file limits. Therefore:

- personal analysis must not depend on cloud quota;
- source MusicXML/MIDI should remain locally analyzable;
- audio should not be uploaded unless a cloud feature requires it and the user chooses to do so;
- cloud corpus/storage access must be isolated behind adapters;
- the application must retain a local-only useful mode if Cloudflare is unavailable.

## 4. Observable's role: companion analytics and publication surface

Observable Framework is valuable for:

- dashboards;
- research notebooks/reports;
- interactive analytical pages;
- curated corpus explorations;
- sharing visualizations;
- static data-driven publications.

Observable Framework builds static sites that can be hosted on many providers, which makes it useful without making it the canonical application runtime.

Official references:

- https://observablehq.com/framework/getting-started
- https://observablehq.com/framework/deploying
- https://observablehq.com/framework/files

### Why Observable should not own the whole application

The mature product needs:

- dynamic user file input;
- local personal libraries;
- many export adapters;
- evolving application state;
- optional large corpus/database queries;
- potentially authenticated storage and synchronization;
- a future native wrapper.

Observable can present these analyses, but canonical music logic should remain in reusable modules imported by any Observable implementation.

The existing Observable integration remains useful and should be completed, but it is a deployment/visualization milestone rather than the final platform decision.

## 5. GitHub Pages role

GitHub Pages remains useful for:

- static prototypes;
- documentation;
- simple demonstration builds;
- emergency/recovery hosting of a client-only application.

GitHub Pages is a static host and has published site/repository/bandwidth constraints. It should not be relied upon as the only future host for a corpus-backed application.

Official reference:

- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

## 6. Future native packaging: Tauri

If native desktop/mobile applications become valuable, Tauri 2 is the current preferred wrapper candidate to evaluate.

Tauri supports existing web frontends and targets Windows, macOS, Linux, Android, and iOS from a shared application codebase.

This fits the constitution because a Tauri application can wrap the same portable web engine rather than creating a second harmonic-analysis implementation.

Official reference:

- https://tauri.app/

Tauri is a later deployment target, not a reason to rewrite the current web engine now.

## 7. Recommended storage model

### Local layer — default for personal work

Store locally:

- imported MusicXML/MIDI references or copies when permitted by browser capabilities;
- derived HIR records;
- personal fingerprints;
- personal tags;
- local search index;
- export settings.

Use documented browser storage abstractions with schema versions. Do not expose raw browser storage calls throughout the domain engine.

### Optional cloud layer

Use a storage adapter for:

- public/reference corpus metadata;
- derived fingerprints;
- search indexes;
- optional synchronized personal fingerprints;
- optional user-selected source assets;
- shared reports.

Proposed mature mapping:

```text
D1:
metadata, users if introduced, fingerprints, feature tables,
corpus provenance, tags, lightweight search metadata

R2:
large optional assets, corpus bundles, generated reports,
user-selected cloud source files

Workers:
API, search orchestration, permissions, optional synchronization
```

A local SQLite-compatible export/import path should be considered so that D1 does not become an irreversible data lock-in.

## 8. Recommended application package boundaries

Long-term target:

```text
packages/
  core-events/
  hir/
  theory/
  holographic/
  fingerprint/
  function/
  voice-leading/
  similarity/
  continuation/
  explanation/
  export/
  corpus/

apps/
  web/
  observable/
  cli/             # later
  tauri/           # later

services/
  cloudflare/      # optional cloud API/index
```

The exact folder migration from the current v0.1 source should occur incrementally and only after tests prove equivalence. Do not reconstruct the working application solely to achieve this target layout.

## 9. Core technology direction

### Current code

Preserve the working JavaScript modules and tests.

### Evolution

Move toward stronger contracts using:

- versioned JSON schemas;
- JSDoc/type declarations immediately where useful;
- TypeScript for new complex schema-heavy modules when it demonstrably reduces ambiguity;
- Web Workers for expensive local fingerprint/corpus computations;
- deterministic pure functions for core theory where possible.

A full TypeScript rewrite is not automatically justified. Migration should be incremental and benchmarked against the constitution's replacement gate.

## 10. Why not make a proprietary desktop application first?

A desktop-first proprietary stack would make mobile access, sharing, Observable integration and open deployment harder while providing little advantage for symbolic MusicXML/MIDI analysis at this stage.

A web/PWA core preserves the largest number of future options.

## 11. Why not make Observable the canonical host?

Observable excels at analytical publishing and dashboards. The final product has broader application requirements. Keeping Observable as a companion surface gives the project its visualization strengths without coupling user-file analysis, persistence, exports and future search infrastructure to one analytical publishing framework.

## 12. Why not make Cloudflare the canonical logic layer?

Cloudflare is the preferred optional production infrastructure, not the music-theory authority.

The same fingerprint for the same input and engine version should be computable locally without Cloudflare.

Cloud services should store/query canonical derived data and coordinate optional shared features, not define music theory differently from the local app.

## 13. Deployment progression

Recommended order:

### Stage A — current

- finish current v0.1;
- deploy/accept Observable visualization;
- retain GitHub canonical source.

### Stage B — local Harmonic Savant

- add user MusicXML/MIDI import;
- HIR;
- transposition/function renderers;
- fingerprints;
- local comparisons;
- exports;
- local personal library.

At this point the application should already be valuable without any cloud backend.

### Stage C — corpus/search web application

- deploy web/PWA to Cloudflare Workers/static assets;
- add optional D1/R2 corpus infrastructure;
- add nearest-neighbor and passage search service where client-only search no longer scales;
- keep local mode intact.

### Stage D — external corpus / artist analytics

- legally usable corpus ingestion;
- artist aggregation;
- Savant-style population distributions;
- searchable public analytical pages.

### Stage E — semantic layer

- listener/user tags;
- affective retrieval;
- learned feeling ↔ fingerprint associations.

### Stage F — native wrappers if justified

- evaluate Tauri with the existing web application;
- preserve identical core-analysis packages and schemas.

## 14. Platform decision

**Current recommended platform architecture:**

```text
CANONICAL SOURCE:       GitHub
CANONICAL APP MODEL:    local-first web/PWA
CANONICAL ANALYSIS:     platform-independent JS/TS modules
PRODUCTION HOST:        Cloudflare Workers + static assets
OPTIONAL DATABASE:      Cloudflare D1
OPTIONAL OBJECT STORE:  Cloudflare R2
ANALYTICS COMPANION:    Observable Framework
STATIC FALLBACK:        GitHub Pages
FUTURE NATIVE WRAPPER:  Tauri 2, if justified
```

This decision may change if a future platform proves superior under the project constitution. The product goals, schemas, exports, local-first capability and scientific semantics must survive any such migration.
