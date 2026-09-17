# Harmonic Savant — HHF-3.1 Local Library Input Checkpoint

Branch: `harmonic-savant-v0.2-core`

Purpose: make the phone-hosted Harmonic Savant useful with user-owned music instead of demo tracks only.

## Implemented

### Local device picker

The visualizer now exposes an **Open music** control backed by a browser file input. It is mobile-first and accepts common browser-decodable audio plus MusicXML/XML.

Accepted picker families:

- `audio/*`
- MP3
- M4A/AAC
- WAV
- FLAC
- OGG/OGA
- Opus
- WebM audio
- MusicXML/XML

The selected file remains local to the browser. Harmonic Savant does not upload the file as part of this workflow.

Protected/DRM tracks that the browser cannot expose or decode remain outside this contract.

### Local audio analysis

`src/music/local-audio.js` adds a dependency-free client-side audio analysis path:

1. Web Audio decodes the user-selected file locally.
2. Multi-channel audio is downmixed to mono.
3. Long audio is bounded by an adaptive frame cap.
4. A Hann-windowed radix-2 FFT produces spectral frames.
5. Spectral bins are mapped into 12 pitch classes.
6. Per-frame chroma is normalized and accumulated into an overall profile.
7. Persistent chroma activity is merged into time-bounded pitch-class proxy events for the existing Holographic visualizer.

The evidence class is explicitly:

`inferred-from-audio`

The UI explicitly states that this is **not score transcription**.

### Local MusicXML

MusicXML/XML files use the existing score parser locally. Score-derived notes remain measured score facts. With no paired audio file, transport playback is disabled while timeline/seek analysis remains available.

### Existing visualizer integration

Local audio feeds the existing adaptive active/shadow field visualizer rather than creating a parallel theory engine. The same pitch-circle, field partition, admissions, scale-candidate, and timeline systems remain in use.

## Tests

`tests/local-audio.test.js` adds:

- common phone audio/MusicXML file classification;
- synthetic A4 chroma recovery;
- synthetic C-major-triad chroma retention;
- browser source contract for Open music, local file input, privacy language, and inferred-audio evidence labeling.

Final implementation test/build checkpoint before this documentation commit:

```text
GitHub Actions run: 35233244969
Commit: 158d1613f67cece7caac71c82977e6dd93ff31a2
npm test: 143 passed / 0 failed
npm run build: PASS
```

## Scientific boundary

Audio chroma is an approximate pitch-class representation derived from the acoustic signal. It is suitable for active/shadow heat, tonal-field exploration, and later fingerprint features that explicitly accept audio-derived evidence. It must not be silently substituted for exact note, voice, spelling, or score-timing facts.

Future audio work may improve source separation, chord segmentation, transcription, tuning estimation, and confidence calibration. Those are additive improvements; they must preserve the current evidence distinction.

## Deployment boundary

The source is implemented and CI-green on GitHub. The existing Vercel MCP connection can create deployments but currently cannot enumerate/read the owning Vercel team scope, so a new public deployment of this checkpoint must not be claimed until the deployed URL is verified to contain the Open music control.
