import { CollectionAwareHolographicHarmonyApp } from "./collection-aware-app.js";
import { SongContinuationPanel } from "./song-continuation-panel.js";
import { complementField } from "../theory/fields.js";
import { FingerprintExplorer } from "./fingerprint-explorer.js";
import { ScoreComparisonPanel } from "./score-comparison-panel.js";
import { workspaceBackupPanel } from "./workspace-backup-panel.js";

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
    this.scoreExplorerRoot = document.createElement("section");
    this.continuationRoot = document.createElement("div");
    this.continuationRoot.className = "harmonic-savant-continuation-host";
    this.root.append(this.visualizerRoot, this.scoreExplorerRoot, this.explorerRoot, this.continuationRoot);

    this.visualizer = new CollectionAwareHolographicHarmonyApp(this.visualizerRoot, tracks);
    this.visualizer.onLoadCommitted = () => { this.panelRecovery = null; };
    this.explorer = new FingerprintExplorer(this.explorerRoot);
    this.scoreExplorer = new ScoreComparisonPanel(this.scoreExplorerRoot, {
      onAnalysisReady: hir => this.visualizer.acceptHarmonicIR(hir)
    });
    this.explorerRoot.hidden = true;
    this.root.addEventListener("harmonic-savant:source-loading", () => this.handleSourceLoading());
    this.root.addEventListener("harmonic-savant:source-restored", () => {
      const saved = this.panelRecovery; if (!saved) return;
      this.panelRecovery = null;
      this.sourceEvidence = saved.evidence;
      this.scoreExplorer.current = saved.current; this.scoreExplorer.analysis = saved.analysis; this.scoreExplorer.audioTitle = saved.audioTitle;
      this.scoreExplorer.renderCurrent(); this.scoreExplorer.renderComparisons();
      this.explorer.current = saved.audio; this.explorerRoot.hidden = !saved.audio; this.explorer.render();
    });
    this.root.addEventListener("harmonic-savant:score-ready", (event) => {
      if (!event.detail.audioReference) this.sourceEvidence = event.detail;
      if (event.detail.audioReference) this.scoreExplorer.setAudioSource({ title: this.visualizer.currentTrack?.title });
      else this.explorerRoot.hidden = true;
      this.scoreExplorer.accept(event.detail);
    });
    this.root.addEventListener("harmonic-savant:fingerprint-ready", (event) => {
      this.scoreExplorer.setAudioSource(event.detail);
      this.explorerRoot.hidden = false; this.explorer.accept(event.detail);
    });
    this.continuation = new SongContinuationPanel(this.continuationRoot, {
      getSourceEvidence: () => this.sourceEvidence,
      onAuditionStart: () => { this.visualizer.audio.pause(); this.visualizer.stopAnimation(); },
      getHolographicContext: (region, song) => this.currentHolographicContext(region, song),
      onSeek: time => this.visualizer.seekTo(time),
      getScoreVoicing: region => {
        if (!region) return null;
        const time = (region.onset + region.end) / 2;
        const notes = this.visualizer.notes.filter(note => note.onset <= time && note.onset + note.duration > time).map(note => note.midi);
        const voicing = [...new Set(notes)].filter(Number.isFinite).sort((a, b) => a - b);
        return voicing.length && voicing.length <= 6 ? voicing : null;
      }
    });
    this.root.addEventListener("harmonic-savant:song-progression-ready", event => this.continuation.acceptSong(event.detail, Math.max(0, this.visualizer.lastRenderTime || 0)));
    this.root.addEventListener("harmonic-savant:playback-position", event => this.continuation.followTime(event.detail));
    this.root.append(workspaceBackupPanel(() => { this.scoreExplorer.corpus = this.scoreExplorer.read(); this.scoreExplorer.renderCurrent(); this.scoreExplorer.renderComparisons(); }));
  }

  currentHolographicContext(region = null, song = null) {
    if (!this.visualizer.currentTrack || !this.visualizer.activeField?.length) return null;
    // Adaptive fields depend on playback history. Only attach the live field
    // when the visualizer actually rendered the selected source and moment.
    if (region && (song?.generation !== this.visualizer.generation ||
      !Number.isFinite(this.visualizer.lastRenderTime) || this.visualizer.lastRenderTime < region.onset ||
      this.visualizer.lastRenderTime >= region.end)) return null;
    const activeField = Object.freeze([...(this.visualizer.currentHarmonicState?.deterministic.activeField ?? this.visualizer.activeField)]);
    return Object.freeze({
      activeField,
      shadowField: Object.freeze(complementField(activeField))
    });
  }

  handleSourceLoading() {
    const track=this.visualizer.loadSession?.state.currentTrack;
    if (track && this.panelRecovery?.track !== track) this.panelRecovery = { track, current: this.scoreExplorer.current, analysis: this.scoreExplorer.analysis,
      audioTitle: this.scoreExplorer.audioTitle, audio: this.explorer.current, evidence: this.sourceEvidence };
    this.sourceEvidence = null;
    this.scoreExplorer.invalidate(); this.explorer.current = null; this.explorer.render();
    this.continuation?.invalidate();
    this.explorerRoot.hidden = true; this.scoreExplorerRoot.hidden = false;
  }

  async initialize() {
    await this.visualizer.initialize();
    return this;
  }
}
