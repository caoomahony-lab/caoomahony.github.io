import { ContinuationPanel } from "./continuation-panel.js";
import { progressionThroughSelection, regionIndexAt } from "../model/song-progression.js";
import { orderedContinuations } from "../continuation/workbench-service.js";
import { matchProgressionReferences, sharedProgressionDevices } from "../catalog/progression-references.js";
import { readFeelingNotes, saveFeelingNote } from "../model/feeling-notes.js";
import { parseChordSequence } from "../input/chord-sequence.js";
import { pitchClassName } from "../theory/pitch.js";
import { CompositionWorkbench } from "./composition-workbench.js";

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
function field(label, control) {
  const node = el("label", "hs-field");
  node.append(el("span", "hs-field-label", label), control);
  return node;
}
function button(text, action) {
  const node = el("button", "hs-secondary", text);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}

export class SongContinuationPanel extends ContinuationPanel {
  constructor(root, { getHolographicContext, onSeek = null, getScoreVoicing = null, getSourceEvidence = null, onAuditionStart = null, storage = null } = {}) {
    super(root, { getHolographicContext });
    this.onSeek = onSeek;
    this.getScoreVoicing = getScoreVoicing;
    try { this.storage = storage || globalThis.localStorage; } catch { this.storage = null; }
    this.song = null;
    this.selectedIndex = -1;
    this.requestId = 0;
    this.playbackTime = 0;
    this.manualProgression = this.progression.value;
    this.buildSongControls();
    this.lab = new CompositionWorkbench(this, {getSourceEvidence:getSourceEvidence||(()=>null),onAuditionStart:onAuditionStart||(()=>{})});
    this.invalidate();
  }

  buildSongControls() {
    this.engineBadge.textContent = "HHF-3.11";
    this.root.dataset.workbenchVersion = "song-workbench-v1";
    this.shell.open = true;
    this.root.querySelector(".hs-compose-subtitle").textContent = "Follow the song, choose a chord, explore what can come next";
    this.autoContext.textContent = "Chord labels and tonal context are interpretations. Continuation scores are heuristic indices, not hit-song probabilities.";
    this.songControls = el("section", "hs-song-controls");
    this.songControls.setAttribute("aria-label", "Song chord selection");
    this.sourceMode = document.createElement("select");
    for (const [value, text] of [["song", "Current song"], ["manual", "Manual progression"]]) {
      const option = el("option", "", text); option.value = value; this.sourceMode.append(option);
    }
    this.sourceMode.addEventListener("change", () => this.changeSourceMode());
    this.title = el("strong", "hs-song-title", "Waiting for song analysis…");
    this.evidence = el("div", "hs-small-note");
    this.follow = document.createElement("input"); this.follow.type = "checkbox"; this.follow.checked = true;
    this.follow.addEventListener("change", () => {
      if (this.follow.checked && this.song && this.sourceMode.value === "song") this.select(regionIndexAt(this.song.regions, this.playbackTime), { seek: false, force: true });
    });
    this.followLabel = el("label", "hs-checkbox"); this.followLabel.append(this.follow, el("span", "", "Follow song playback"));
    this.chordControls = el("div", "hs-song-chords");
    this.chordSlider = document.createElement("input");
    this.chordSlider.type = "range"; this.chordSlider.min = "0"; this.chordSlider.step = "1"; this.chordSlider.max = "0";
    this.chordSlider.setAttribute("aria-label", "Select song chord");
    this.chordSlider.addEventListener("input", () => this.select(Number(this.chordSlider.value), { seek: true }));
    this.position = el("div", "hs-song-position");
    this.chordList = el("div", "hs-song-chord-list");
    this.chordList.setAttribute("aria-label", "Song chord sequence");
    this.interpretation = document.createElement("select");
    this.interpretation.addEventListener("change", () => this.updateSelectedProgression());
    this.chordControls.append(field("Select a chord in the song", this.chordSlider), this.position, this.chordList,
      field("Chord interpretation for this sketch", this.interpretation));
    this.actualNext = el("div", "hs-actual-next");
    const presetLabel = this.preset.closest("label");
    presetLabel.querySelector(".hs-field-help").textContent = "Visible objective; unavailable corpus/style evidence stays unknown.";
    this.preset.value = "functional";
    this.preset.addEventListener("change", () => this.run());
    this.songControls.append(field("Progression source", this.sourceMode), this.title, this.evidence, this.followLabel,
      this.chordControls, this.actualNext, presetLabel);
    this.body.prepend(this.songControls);
    this.referenceOutput = el("section", "hs-result-card hs-reference-output");
    this.referenceOutput.setAttribute("aria-label", "Related progressions and feelings");
    this.body.insertBefore(this.referenceOutput, this.output);
    this.feelingsControls = el("div", "hs-feeling-controls");
    this.feelingInput = document.createElement("input"); this.feelingInput.className = "hs-input";
    this.feelingInput.placeholder = "e.g. restless, hopeful, nostalgic"; this.feelingInput.maxLength = 390;
    this.feelingStatus = el("div", "hs-small-note"); this.feelingStatus.setAttribute("aria-live", "polite");
    this.feelingsControls.append(field("Your feelings about this chord / moment", this.feelingInput),
      button("Save feeling note on this device", () => this.saveFeeling()), this.feelingStatus,
      button("Export my feeling notes", () => this.exportFeelings()));
    this.body.insertBefore(this.feelingsControls, this.output);
    this.progression.readOnly = true;
    for (const control of [this.progression, this.voicing, this.contextTonic, this.system, this.targetTonic, this.missingPolicy, this.useCurrentField]) {
      control.addEventListener("input", () => this.invalidateAnalysis());
    }
    this.actionStatus.setAttribute("aria-live", "polite");
    this.runButton.textContent = "Explore next chords";
    this.shell.addEventListener("toggle", () => {
      if (this.shell.open && this.needsAnalysis) this.run();
    });
  }

  cancelAnalysis() {
    this.lab?.audition.stop();
    this.requestId++;
    clearTimeout(this.workerTimeout);
    this.worker?.terminate(); this.worker = null;
    this.runButton.disabled = false;
    if (this.pendingBranch) { this.pendingBranch.textContent = "Branch canceled by a newer selection."; this.pendingBranch = null; }
  }

  invalidateAnalysis() {
    this.cancelAnalysis(); this.session = null; this.sessionOptions = null;
    this.exportButton.disabled = true; this.output.replaceChildren();
    this.actionStatus.textContent = "Options changed · explore next chords to update.";
    this.needsAnalysis = Boolean(this.progression.value.trim());
    if (this.sourceMode.value === "manual") this.referenceOutput.replaceChildren();
  }

  changeSourceMode() {
    const isSong = this.sourceMode.value === "song";
    if (isSong) this.manualProgression = this.progression.value;
    this.invalidateAnalysis();
    this.referenceOutput.replaceChildren();
    this.progression.readOnly = isSong;
    this.followLabel.hidden = !isSong; this.chordControls.hidden = !isSong;
    this.feelingsControls.hidden = true;
    if (!isSong) {
      this.progression.value = this.manualProgression;
      this.referenceOutput.replaceChildren();
      this.actualNext.textContent = "Manual sketch · imported music is unchanged.";
    } else if (this.song) {
      const index = this.follow.checked || this.selectedIndex < 0 ? regionIndexAt(this.song.regions, this.playbackTime) : this.selectedIndex;
      this.select(index, { seek: false, force: true });
    } else {
      this.progression.value = ""; this.actualNext.textContent = "Waiting for song analysis…";
      this.needsAnalysis = false;
    }
    this.lab?.refresh();
  }

  invalidate() {
    this.lab?.reset();
    this.cancelAnalysis();
    this.song = null; this.selectedIndex = -1; this.session = null; this.sessionOptions = null;
    this.selectedHolographic = null; this.playbackTime = 0;
    this.exportButton.disabled = true; this.needsAnalysis = false;
    this.output.replaceChildren(); this.referenceOutput.replaceChildren();
    this.title.textContent = "Waiting for song analysis…";
    this.evidence.textContent = "Open a score or audio file, or switch to a manual sketch.";
    this.chordSlider.disabled = true; this.interpretation.disabled = true;
    this.interpretation.replaceChildren();
    this.chordList.replaceChildren(); this.position.textContent = ""; this.actualNext.textContent = "";
    this.feelingsControls.hidden = true; this.actionStatus.textContent = "";
    if (this.sourceMode.value === "song") this.progression.value = "";
  }

  acceptSong(song, timeSeconds = 0) {
    this.lab?.reset();
    this.cancelAnalysis();
    this.song = song;
    this.playbackTime = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    this.session = null; this.sessionOptions = null;
    this.exportButton.disabled = true; this.output.replaceChildren();
    this.title.textContent = song.title;
    this.evidence.textContent = song.evidenceClass === "measured-notes-inferred-chords"
      ? "Score notes and timing are measured; chord labels are inferred."
      : "Audio chord labels, boundaries and timing are inferred; check alternate readings.";
    this.chordSlider.disabled = !song.regions.length;
    this.chordSlider.max = String(Math.max(0, song.regions.length - 1));
    this.selectedIndex = -1;
    if (this.sourceMode.value === "song") this.select(regionIndexAt(song.regions, timeSeconds), { seek: false, force: true });
  }

  followTime({ timeSeconds, generation }) {
    if (!this.song || generation !== this.song.generation || !Number.isFinite(timeSeconds)) return;
    this.playbackTime = timeSeconds;
    if (!this.follow.checked || this.sourceMode.value !== "song") return;
    const index = regionIndexAt(this.song.regions, timeSeconds);
    if (index !== this.selectedIndex) this.select(index, { seek: false });
  }

  select(index, { seek = false, force = false } = {}) {
    if (this.sourceMode.value !== "song" || !this.song) return;
    if (!force && index === this.selectedIndex && !seek) return;
    this.cancelAnalysis(); this.session = null; this.exportButton.disabled = true;
    this.output.replaceChildren(); this.actionStatus.textContent = "";
    this.selectedIndex = index;
    const region = this.song.regions[index];
    this.interpretation.replaceChildren(); this.interpretation.disabled = !region;
    this.feelingsControls.hidden = !region;
    if (!region) {
      this.lab?.reset();
      this.selectedHolographic = null;
      this.position.textContent = "No sounding chord at the current position.";
      this.chordSlider.setAttribute("aria-valuetext", "No sounding chord");
      this.progression.value = ""; this.actualNext.textContent = "";
      this.referenceOutput.replaceChildren(); this.chordList.replaceChildren(); this.needsAnalysis = false;
      return;
    }
    this.chordSlider.value = String(index);
    this.position.textContent = `Chord ${index + 1} of ${this.song.regions.length} · ${region.symbol || "unresolved"} · ${region.onset.toFixed(2)}–${region.end.toFixed(2)} s`;
    this.chordSlider.setAttribute("aria-valuetext", this.position.textContent);
    this.chordList.replaceChildren();
    const start = Math.max(0, Math.min(index - 7, this.song.regions.length - 15));
    for (let i = start; i < Math.min(start + 15, this.song.regions.length); i++) {
      const item = this.song.regions[i];
      const node = button(`${i + 1}. ${item.symbol || "?"}`, () => this.select(i, { seek: true }));
      node.setAttribute("aria-pressed", String(i === index));
      this.chordList.append(node);
    }
    const original = el("option", "", region.symbol ? `Song reading: ${region.symbol}` : "Unresolved: choose an interpretation");
    original.value = ""; this.interpretation.append(original);
    for (const candidate of region.candidates.filter(item => item.symbol && item.symbol !== region.symbol)) {
      const option = el("option", "", `Alternative: ${candidate.symbol}`); option.value = candidate.symbol;
      this.interpretation.append(option);
    }
    const next = this.song.regions[index + 1];
    this.actualNext.textContent = next
      ? `Next in the song: ${next.symbol || "unresolved"} at ${next.onset.toFixed(2)} s${next.onset > region.end + 1e-9 ? " (after a rest)" : ""}. Suggestions below are hypothetical.`
      : "End of the analyzed song. Suggestions below are hypothetical.";
    this.feelingInput.value = "";
    this.refreshFeelingStatus();
    if (seek) this.onSeek?.(region.onset);
    this.selectedHolographic = this.getHolographicContext?.(region, this.song);
    this.lab?.onSelection();
    this.updateSelectedProgression();
  }

  updateSelectedProgression() {
    if (!this.song?.regions[this.selectedIndex]) return;
    this.cancelAnalysis(); this.session = null; this.exportButton.disabled = true; this.output.replaceChildren();
    const selected = progressionThroughSelection(this.song, this.selectedIndex, { symbolOverride: this.interpretation.value || null });
    this.progression.value = selected.progression || "";
    this.renderReferences(selected.startIndex);
    if (!selected.progression) {
      this.cancelAnalysis(); this.output.replaceChildren(); this.session = null; this.exportButton.disabled = true;
      this.actionStatus.textContent = selected.reason; return;
    }
    this.needsAnalysis = true;
    if (this.shell.open) this.run();
  }

  analysisOptions() {
    const holographic = this.useCurrentField.checked ? (this.sourceMode.value === "song" ? this.selectedHolographic : this.getHolographicContext?.()) : null;
    const scoreVoicing = this.sourceMode.value === "song" && this.song?.evidenceClass === "measured-notes-inferred-chords"
      ? this.getScoreVoicing?.(this.song.regions[this.selectedIndex]) : null;
    return { progression: this.progression.value, currentVoicing: this.voicing.value.trim() || scoreVoicing?.join(" ") || "",
      contextTonic: this.contextTonic.value, systemId: this.system.value, targetTonic: this.targetTonic.value,
      activeField: holographic?.activeField ?? null, shadowField: holographic?.shadowField ?? null,
      ranking: this.preset.value ? { preset: this.preset.value, missingPolicy: this.missingPolicy.value, limit: 6 } : null,
      ...(this.lab?.options()||{}) };
  }

  request(request, done, failed) {
    this.cancelAnalysis();
    const id = this.requestId;
    let worker;
    try { worker = this.worker = new Worker(new URL("../continuation/workbench-worker.js", import.meta.url), { type: "module" }); }
    catch (error) { this.cancelAnalysis(); throw error; }
    const started=performance.now();
    const finish = () => { this.lastWorkerDurationMs=performance.now()-started; clearTimeout(this.workerTimeout); worker.terminate(); this.worker = null; this.runButton.disabled = false; };
    worker.addEventListener("message", ({ data }) => {
      if (id !== this.requestId || worker !== this.worker || data.id !== id) return;
      finish();
      if (data.error) failed(data.error); else done(data.result);
    });
    worker.addEventListener("error", event => {
      if (id !== this.requestId || worker !== this.worker) return;
      finish();
      failed(event.message || "The local continuation worker could not start.");
    });
    this.workerTimeout = setTimeout(() => {
      if (id !== this.requestId || worker !== this.worker) return;
      finish(); failed("Local analysis timed out. Try a shorter progression or fewer voicing constraints.");
    }, 30000);
    try { worker.postMessage({ ...request, id }); }
    catch (error) { finish(); this.requestId++; throw error; }
  }

  run() {
    this.cancelAnalysis();
    this.session = null; this.sessionOptions = null; this.exportButton.disabled = true;
    this.output.replaceChildren();
    if (!this.progression.value.trim()) { this.actionStatus.textContent = "Select a resolved chord or enter a manual progression."; return; }
    this.needsAnalysis = false;
    this.session = null; this.exportButton.disabled = true;
    this.output.replaceChildren(); this.actionStatus.textContent = "Analyzing locally…";
    try {
      const options = this.analysisOptions();
      if (this.sourceMode.value === "manual") this.renderReferenceMatches(parseChordSequence(options.progression).chords, 0, "Manual sketch");
      this.request({ type: "analyze", options }, result => {
        this.session = result.session; this.sessionOptions = options; this.exportButton.disabled = false;
        this.render(result.session); this.actionStatus.textContent = `${result.session.composition ? "Ready · composition-context hypotheses" : "Ready · local-chord heuristic baseline"} · local worker ${this.lastWorkerDurationMs.toFixed(0)} ms`;
      }, message => this.showError(message));
      this.runButton.disabled = true;
    } catch (error) { this.showError(error.message); }
  }

  showError(message) {
    this.session = null; this.exportButton.disabled = true; this.runButton.disabled = false;
    this.actionStatus.textContent = `Could not analyze: ${message}`;
  }

  render(session) {
    const functional = el("details", "hs-advanced");
    functional.append(el("summary", "", "Tonal context and functional translation"), this.renderContext(session), this.renderProgression(session));
    const candidates = el("section", "hs-result-card"); candidates.append(el("div", "hs-result-title", "What can go next?"),
      el("div", "hs-small-note", `${session.composition?`Active objective: ${session.composition.intention}. Local baseline remains available in the method selector.`:session.ranking ? `Objective: ${session.ranking.preset}.` : "Unranked, deterministic source order."} Scores are indices out of 100. Corpus and learned style are unavailable without supporting data.`));
    if(session.composition) candidates.append(el("p","composition-scope",`${session.composition.intention}: ${session.composition.definition}`),
      el("p","hs-small-note",`Weights: ${Object.entries(session.composition.weights).map(([k,v])=>`${k}=${v}`).join(" · ")}. ${session.composition.context.scope}`));
    for (const { entry, rank } of orderedContinuations(session)) {
      const row = el("article", "hs-continuation-row");
      const symbol = entry.presentation.symbol;
      row.append(el("strong", "hs-continuation-symbol", symbol || "Pitch-set candidate"),
        el("span", "hs-continuation-function", ` ${entry.presentation.roman || ""}${rank ? ` · objective ${Math.round(rank.combinedScore * 100)}/100` : ""}`),
        el("div", "hs-candidate-explanation", entry.presentation.beginner || "Context-dependent possibility."));
      const dimensions = el("div", "hs-small-note");
      dimensions.textContent = [["functional", "Function"], ["voiceLeading", "Voice leading"], ["novelty", "Novelty"], ["holographicContinuity", "Holographic"]]
        .map(([key, name]) => `${name}: ${entry.dimensions[key].available ? `${Math.round(entry.dimensions[key].score * 100)}/100` : "unavailable"}`).join(" · ");
      row.append(dimensions);
      if(rank?.composition){const evidence=el("details","composition-candidate-evidence");evidence.append(el("summary","","Inspect composition inputs and weighted scores"));
        for(const [name,value]of Object.entries(rank.composition.dimensions))evidence.append(el("p","hs-small-note",`${name}: ${value.available?Math.round(value.score*100)+"/100":"unavailable"} · ${value.basis} · effective weight ${(rank.composition.effectiveWeights[name]||0).toFixed(3)}`));row.append(evidence);}
      const voice = entry.dimensions.voiceLeading;
      if (voice.available && voice.bestVoicing?.length) row.append(el("div", "hs-best-voicing", `Generated closest voicing: ${voice.bestVoicing.map(midi => `${pitchClassName(midi % 12)}${Math.floor(midi / 12) - 1}`).join(" · ")} · ${voice.movementSemitones} semitones of total motion`));
      if(this.lab)row.append(button(`Audition generated ${symbol}`,()=>this.lab.preview(entry,rank)));
      const branch = el("div", "hs-branch-results");
      const explore = button(`Where ${symbol} can lead`, () => {
        if (this.session !== session || !this.sessionOptions) return;
        branch.textContent = "Exploring a hypothetical branch locally…";
        try {
          this.request({ type: "branch", chord: symbol, options: this.sessionOptions }, result => {
            if (this.pendingBranch === branch) this.pendingBranch = null;
            branch.replaceChildren(el("div", "hs-small-note", `Hypothetical: ${symbol} → … · ${result.context.source} ${result.context.centerName} ${result.context.systemName}`));
            for (const item of result.continuations) {
              const itemRow=el("div","hs-branch-item",`${symbol} → ${item.symbol} · ${item.roman || ""}${item.score == null ? "" : ` · ${Math.round(item.score * 100)}/100`} · ${item.explanation || ""}`),third=el("div","hs-third-step");
              itemRow.append(button(`Explore after ${symbol} → ${item.symbol}`,()=>{
                if(this.session!==session||!this.sessionOptions)return;
                third.textContent="Exploring a further hypothetical step…";
                try{this.request({type:"branch",chord:`${symbol} | ${item.symbol}`,options:this.sessionOptions},next=>{
                  third.replaceChildren();for(const last of next.continuations)third.append(el("p","hs-small-note",`Hypothetical: ${symbol} → ${item.symbol} → ${last.symbol} · ${last.explanation||""}`));
                },message=>{third.textContent=`Step unavailable: ${message}`;});}catch(error){third.textContent=error.message;}
              }),third);branch.append(itemRow);
            }
          }, message => { if (this.pendingBranch === branch) this.pendingBranch = null; branch.textContent = `Branch unavailable: ${message}`; });
          this.pendingBranch = branch;
        } catch (error) { branch.textContent = error.message; }
      });
      row.append(explore, branch); candidates.append(row);
    }
    candidates.append(el("div", "hs-evidence-note", session.notes.join(" ")));
    this.output.replaceChildren(candidates, functional);
  }

  renderReferences(startIndex) {
    const selected = this.song.regions.slice(startIndex, this.selectedIndex + 1).map(region => ({ ...region }));
    if (this.interpretation.value) {
      const override = this.song.regions[this.selectedIndex].candidates.find(item => item.symbol === this.interpretation.value);
      if (override) Object.assign(selected.at(-1), override);
    }
    this.renderReferenceMatches(selected, startIndex, "Song history through the selection");
  }

  renderReferenceMatches(regions, startIndex, scope) {
    const matches = matchProgressionReferences(regions);
    const devices = matches.length ? [] : sharedProgressionDevices(regions);
    this.referenceOutput.replaceChildren(el("div", "hs-result-title", "Related songs & source-reported feelings"));
    this.referenceOutput.append(el("div", "hs-small-note", `Small curated reference set · ${scope}. No whole-song similarity percentage.`));
    if (!matches.length && !devices.length) this.referenceOutput.append(el("p", "hs-small-note", "No supported reference match in this small set. Select a later chord to include more history."));
    for (const match of [...matches, ...devices]) {
      const row = el("article", "hs-reference-match");
      const link = el("a", "", `${match.reference.title} — ${match.reference.artist}`);
      link.href = match.reference.url; link.target = "_blank"; link.rel = "noopener noreferrer";
      row.append(link, el("div", "hs-small-note", match.kind === "ordered-chord-skeleton"
        ? `${match.length} ordered chords · song chords ${startIndex + match.startIndex + 1}–${startIndex + match.endIndex + 1} · reference shifted +${match.shift} semitones · ${match.reference.section}. ${match.note}` : match.note));
      if (match.reference.tags.length) row.append(el("div", "hs-small-note", `Reference page descriptors: ${match.reference.tags.join(", ")}. Subjective source labels; they do not predict how your song feels.`));
      this.referenceOutput.append(row);
    }
  }

  refreshFeelingStatus() {
    const region = this.song?.regions[this.selectedIndex];
    if (!region) return;
    const note = readFeelingNotes(this.storage).find(item => item.sourceId === this.song.sourceId && item.segmentId === `${this.selectedIndex}:${region.onset}:${region.end}`);
    this.feelingStatus.textContent = note ? `Your saved note: ${note.tags.map(tag => tag.label).join(", ")}` : "Your personal interpretation, saved locally with song and time provenance.";
  }

  saveFeeling() {
    try { saveFeelingNote(this.storage, this.song, this.selectedIndex, this.feelingInput.value); this.refreshFeelingStatus(); }
    catch (error) { this.feelingStatus.textContent = `Could not save: ${error.message}`; }
  }

  exportFeelings() {
    let notes;
    try { notes = readFeelingNotes(this.storage, { strict: true }).filter(note => note.sourceId === this.song?.sourceId); }
    catch (error) { this.feelingStatus.textContent = `Could not export: ${error.message}`; return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: "feeling-notes-export-v1", notes }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "harmonic-feeling-notes.json";
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
