# HHF-3.8 — Local Savant Fingerprint Explorer

This is a deliberately small Vercel-facing feature layer, not a replacement for the canonical fingerprint engine.

## Purpose

Turn local audio analysis into a reusable browser-only corpus and a six-slider nearest-neighbor explorer.

The beta dimensions are:

- harmonic motion;
- recurrence;
- center clarity;
- collection adherence;
- pitch diversity;
- surface activity.

All six are derived from existing local audio/harmony evidence. They are normalized to 0–1 for interaction and are explicitly labeled inferred-from-audio.

## Privacy

Saved fingerprints use browser localStorage only. Audio files are not uploaded or committed.

## Scope boundary

This does not claim to be the frozen HHF-4 fingerprint schema. It is an interaction prototype for the eventual Savant explorer and gives the current Vercel app a useful multi-piece comparison workflow without duplicating DSP.

## Deployment source

Production should build from this canonical branch with `holographic-harmony` as the Vercel root directory.
