import { HolographicHarmonyApp } from "./app.js";
import { ContinuationPanel } from "./continuation-panel.js";
import { complementField } from "../theory/fields.js";

export class HarmonicSavantApp {
  constructor(root, tracks) {
    if (!root) throw new TypeError("HarmonicSavantApp requires a root element");
    this.root = root;
    this.tracks = tracks;
    this.root.innerHTML = "";
    this.root.classList.add("harmonic-savant-root");

    this.visualizerRoot = document.createElement("div");
    this.visualizerRoot.className = "harmonic-savant-visualizer-host";
    this.continuationRoot = document.createElement("div");
    this.continuationRoot.className = "harmonic-savant-continuation-host";
    this.root.append(this.visualizerRoot, this.continuationRoot);

    this.visualizer = new HolographicHarmonyApp(this.visualizerRoot, tracks);
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
