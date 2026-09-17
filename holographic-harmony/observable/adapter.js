import { HolographicHarmonyApp } from "../src/app/app.js";
import { HarmonicSavantApp } from "../src/app/harmonic-savant-app.js";

function validateHost(root, tracks) {
  if (!root) throw new Error("Observable host element is required");
  if (!Array.isArray(tracks) || !tracks.length) throw new Error("At least one resolved track is required");
}

/**
 * Legacy/reference visualizer mount.
 *
 * Kept for backwards compatibility and for Observable pages that intentionally
 * expose only the original Holographic Harmony visualizer.
 * Observable is not part of the analysis engine.
 * Pass fully resolved FileAttachment URLs in each track object.
 */
export async function mountObservableHolographicHarmony(root, tracks) {
  validateHost(root, tracks);
  const app = new HolographicHarmonyApp(root, tracks);
  await app.initialize();
  return app;
}

/**
 * Harmonic Savant mount.
 *
 * Wraps the existing HolographicHarmonyApp with the HHF-022 continuation panel.
 * The panel consumes the reusable core/session APIs; Observable must not
 * duplicate chord parsing, function inference, key translation, candidate
 * generation, continuation scoring, voice-leading, or ranking logic.
 */
export async function mountObservableHarmonicSavant(root, tracks) {
  validateHost(root, tracks);
  const app = new HarmonicSavantApp(root, tracks);
  await app.initialize();
  return app;
}
