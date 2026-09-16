import "./styles/app.css";
import { loadTrackManifest } from "./app/tracks.js";
import { HolographicHarmonyApp } from "./app/app.js";

export async function mountHolographicHarmony(root, options = {}) {
  const tracks = options.tracks || await loadTrackManifest(options.manifestUrl || "./public/tracks/tracks.json");
  const app = new HolographicHarmonyApp(root, tracks);
  await app.initialize();
  return app;
}

const root = document.querySelector("#app");
if (root) {
  mountHolographicHarmony(root).catch((error) => {
    console.error(error);
    root.innerHTML = `<pre class="fatal-error">${error.message}</pre>`;
  });
}
