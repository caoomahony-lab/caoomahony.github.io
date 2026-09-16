import { HolographicHarmonyApp } from "../src/app/app.js";

/**
 * Thin Observable adapter. Observable is not part of the analysis engine.
 * Pass fully resolved FileAttachment URLs in each track object.
 */
export async function mountObservableHolographicHarmony(root, tracks) {
  if (!root) throw new Error("Observable host element is required");
  if (!Array.isArray(tracks) || !tracks.length) throw new Error("At least one resolved track is required");
  const app = new HolographicHarmonyApp(root, tracks);
  await app.initialize();
  return app;
}
