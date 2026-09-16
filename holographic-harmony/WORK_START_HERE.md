# WORK_START_HERE — Holographic Harmony Visualizer

## Mission

Deploy the verified GitHub implementation to Observable with the smallest possible integration layer.

The application is already responsible for:

- MusicXML parsing and tempo mapping
- octave collapse to 12 pitch classes
- active-field / exact-shadow partitioning
- activity heat and decay
- white transient shadow admissions
- ordered-admission history
- candidate scale/center inference
- candidate crystallization support
- synchronized audio playback and seeking
- fixed-height responsive 12-pitch visualization
- stale-load protection during song switching

## Source-of-truth rule

GitHub source is canonical. Observable is a deployment target, not a second implementation.

## Before Observable

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

Read `observable/OBSERVABLE_HANDOFF.md` next.
