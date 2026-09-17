import { loadTrackManifest } from "./app/tracks.js";
import { HolographicHarmonyApp } from "./app/app.js";
import { HarmonicSavantApp } from "./app/harmonic-savant-app.js";

export async function mountHolographicHarmony(root, options = {}) {
  const tracks = options.tracks || await loadTrackManifest(options.manifestUrl || "./public/tracks/tracks.json");
  const app = new HolographicHarmonyApp(root, tracks);
  await app.initialize();
  return app;
}

export async function mountHarmonicSavant(root, options = {}) {
  const tracks = options.tracks || await loadTrackManifest(options.manifestUrl || "./public/tracks/tracks.json");
  const app = new HarmonicSavantApp(root, tracks);
  await app.initialize();
  return app;
}

const root = document.querySelector("#app");
if (root) {
  mountHarmonicSavant(root).catch((error) => {
    console.error(error);
    root.innerHTML = `<pre class="fatal-error">${error.message}</pre>`;
  });
}
