import { CollectionAwareHolographicHarmonyApp } from "./collection-aware-app.js";
import { ContinuationPanel } from "./continuation-panel.js";
import { complementField } from "../theory/fields.js";
import { FingerprintExplorer } from "./fingerprint-explorer.js";

export class HarmonicSavantApp {
  constructor(root, tracks) {
    if (!root) throw new TypeError("HarmonicSavantApp requires a root element");
    this.root = root;
    this.tracks = tracks;
    this.root.innerHTML = "";
    this.root.classList.add("harmonic-savant-root");

    this.visualizerRoot = document.createElement("div");
    this.visualizerRoot.className = "harmonic-savant-visualizer-host";
    this.explorerRoot = document.createElement("section");
    this.continuationRoot = document.createElement("div");
    this.continuationRoot.className = "harmonic-savant-continuation-host";
    this.root.append(this.visualizerRoot, this.explorerRoot, this.continuationRoot);

    this.visualizer = new CollectionAwareHolographicHarmonyApp(this.visualizerRoot, tracks);
    this.explorer = new FingerprintExplorer(this.explorerRoot);
    this.root.addEventListener("harmonic-savant:fingerprint-ready", (event) => this.explorer.accept(event.detail));
    this.continuation = new ContinuationPanel(this.continuationRoot, {
      getHolographicContext: () => this.currentHolographicContext()
    });
  }

  currentHolographicContext() {
    if (!this.visualizer.currentTrack || !this.visualizer.activeField?.length) return null;
    const activeField = Object.freeze([...this.visualizer.activeField]);
    return Object.freeze({
      activeField,
      shadowField: Object.freeze(complementField(activeField))
    });
  }

  async initialize() {
    await this.visualizer.initialize();
    return this;
  }
}
