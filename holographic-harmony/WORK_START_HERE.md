# WORK_START_HERE — Holographic Harmony / Harmonic Savant

## Governing documents — read before code

Read these in order:

1. `PROJECT_CONSTITUTION.md` — non-negotiable product goals and replacement rules.
2. `HARMONIC_SAVANT_MASTER_PLAN.md` — implementation blueprint and milestone order.
3. `observable/OBSERVABLE_HANDOFF.md` — Observable-specific deployment rules when applicable.
4. repository-root `ENGINEERING_DOCTRINE.md` — general engineering doctrine.

If a work ticket, deployment convenience, framework limitation, or implementation preference conflicts with `PROJECT_CONSTITUTION.md`, stop and report the conflict. Do not silently shrink the goal.

## Mission

Build and deploy the Harmonic Savant system as a reusable, platform-independent harmonic-analysis engine with Holographic Harmony visualization. The current v0.1 visualizer is the first working front end, not the final product boundary.

The application is already responsible for:

- MusicXML parsing and tempo mapping;
- octave collapse to 12 pitch classes while retaining registered score information;
- active-field / exact-shadow partitioning;
- activity heat and decay;
- white transient shadow admissions;
- ordered-admission history;
- candidate scale/center inference;
- candidate crystallization support;
- synchronized audio playback and seeking;
- fixed-height responsive 12-pitch visualization;
- stale-load protection during song switching.

Long-term accepted capabilities include, and must not be removed merely for convenience:

- user-owned MusicXML/MIDI analysis without subscription lock-in;
- transposition-independent functional representation;
- translation of function to any user-selected key;
- expert, beginner, and machine-readable explanations from the same analysis;
- open/documented export adapters;
- whole-piece and passage harmonic fingerprints;
- personal and external-corpus similarity search;
- functional chord analysis;
- voice-leading analysis;
- multi-objective next-chord recommendations;
- adjustable synthetic fingerprint search;
- Holographic active/shadow/admission analysis;
- eventual empirical feeling ↔ harmonic-neighborhood search;
- deployment portability beyond any one vendor.

## Source-of-truth rule

GitHub source and versioned domain schemas are canonical. Observable, Cloudflare, desktop/mobile wrappers, and other hosts are deployment or presentation targets, not alternate theory implementations.

## Better-way rule

A new parser, framework, analysis method, storage design, similarity metric, or platform may replace an older one only after the replacement gate in `PROJECT_CONSTITUTION.md` is satisfied. Until then, keep the new method additive/experimental.

Do not preserve obsolete code for its own sake; preserve accepted user capability and scientific meaning.

## Before Observable or release work

Run:

```bash
npm ci
npm test
npm run build
```

All commands must succeed before integration work begins.

## Acceptance

- No console errors during normal use.
- Audio and score state stay synchronized.
- Repeated A→B→A track changes do not leave ghost audio or stale state.
- Track duration never changes document height.
- Main circle remains bounded on phone and desktop widths.
- Active and shadow sets always form an exact Z12 partition.
- Candidate tonal readings are visibly distinguished from measured/set facts.
- Core analysis remains independent of the deployment host.
- No accepted constitution goal is removed or redefined silently.

For Observable work, read `observable/OBSERVABLE_HANDOFF.md` next.
