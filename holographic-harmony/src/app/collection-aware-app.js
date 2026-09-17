import { HolographicHarmonyApp } from "./app.js";
import { complementField, fieldLabel, validatePartition } from "../theory/fields.js";
import { computePitchClassActivity } from "../theory/activity.js";
import { computeAdmissionHistory, compareAdmissionOrder } from "../theory/admissions.js";
import { inferScaleCandidates, crystallizationSupport } from "../theory/inference.js";
import { inferCollectionCenterState } from "../inference/collection-center.js";
import { inferAudioHarmonySegments } from "../inference/audio-harmony.js";
import { analyzeLocalAudioFile } from "../music/local-audio.js";
import { pitchClassName } from "../theory/pitch.js";

const LOCAL_TRACK_ID = "__local_music__";

function create(tag, className, text = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

export class CollectionAwareHolographicHarmonyApp extends HolographicHarmonyApp {
  constructor(root, tracks) {
    super(root, tracks);
    this.currentCollection = null;
    this.audioHarmony = null;
    this.harmonySegmentEls = [];
  }

  buildUI() {
    super.buildUI();
    this.primaryDiagnosticLabel = this.fieldEl?.parentElement?.querySelector(".diag-label") || null;
    const centerLabel = this.candidatesEl?.parentElement?.querySelector(".diag-label");
    if (centerLabel) centerLabel.textContent = "CENTER / MODE HYPOTHESES";

    this.harmonyCard = create("section", "audio-harmony-card");
    this.harmonyCard.hidden = true;
    const heading = create("div", "audio-harmony-heading");
    heading.append(
      create("div", "timeline-title", "AUDIO HARMONIC TIMELINE · inferred chord segments"),
      create("div", "audio-harmony-evidence", "INFERRED FROM AUDIO")
    );
    const now = create("div", "audio-harmony-now");
    this.harmonyCurrent = create("div", "audio-harmony-current", "—");
    this.harmonyFunction = create("div", "audio-harmony-function", "No audio segmentation loaded.");
    this.harmonyAlternatives = create("div", "audio-harmony-alternatives", "");
    now.append(this.harmonyCurrent, this.harmonyFunction, this.harmonyAlternatives);
    this.harmonyTrack = create("div", "audio-harmony-track");
    this.harmonyTrack.setAttribute("aria-label", "Inferred harmonic segments");
    this.harmonySummary = create("div", "audio-harmony-summary", "");
    this.harmonyCard.append(heading, now, this.harmonyTrack, this.harmonySummary);
    const footer = this.root.querySelector(".hhv-footer");
    if (footer) this.root.insertBefore(this.harmonyCard, footer);
    else this.root.appendChild(this.harmonyCard);
  }

  beginLoad(status = "LOADING") {
    const generation = super.beginLoad(status);
    this.currentCollection = null;
    this.audioHarmony = null;
    this.harmonySegmentEls = [];
    if (this.harmonyCard) this.harmonyCard.hidden = true;
    if (this.harmonyTrack) this.harmonyTrack.innerHTML = "";
    if (this.primaryDiagnosticLabel) this.primaryDiagnosticLabel.textContent = "CURRENT FIELD";
    return generation;
  }

  async loadLocalAudio(file) {
    const generation = this.beginLoad("ANALYZING HARMONY");
    this.releaseLocalObjectUrl();
    this.ensureLocalOption(file.name || "local audio");
    this.modeBadge.textContent = "LOCAL AUDIO · INFERRED";
    this.sourceNote.textContent = `Analyzing ${file.name} locally. Pitch classes, chord boundaries, roots and qualities are inferred evidence.`;

    try {
      const analysis = await analyzeLocalAudioFile(file);
      if (generation !== this.generation) return;
      const harmony = inferAudioHarmonySegments(analysis.frames, analysis.hopSeconds);
      if (generation !== this.generation) return;
      const overallCandidate = inferScaleCandidates(analysis.overallChroma, 1)[0];
      this.notes = [...analysis.events];
      this.activeField = overallCandidate?.pcs ? [...overallCandidate.pcs] : [0, 2, 4, 5, 7, 9, 11];
      this.shadowField = complementField(this.activeField);
      const partition = validatePartition(this.activeField, this.shadowField);
      if (!partition.valid) throw new Error("Active/shadow partition failed Z12 invariant");

      this.audioHarmony = harmony;
      this.localObjectUrl = URL.createObjectURL(file);
      this.currentTrack = Object.freeze({
        id: LOCAL_TRACK_ID,
        title: file.name,
        audio: this.localObjectUrl,
        audioOffset: 0,
        durationHint: analysis.durationSeconds,
        local: true,
        evidenceClass: analysis.evidenceClass,
        analysis: Object.freeze({ mode: "adaptive", audioHarmonyVersion: harmony.version })
      });
      this.audio.src = this.localObjectUrl;
      this.audio.currentTime = 0;
      this.audio.load();
      this.duration = analysis.durationSeconds;
      this.playButton.disabled = false;
      this.status.textContent = "READY";
      this.sourceNote.textContent = `${file.name} · analyzed locally · ${analysis.frameCount} chroma frames · ${harmony.segmentCount} inferred harmonic segments. Nothing was uploaded by Harmonic Savant.`;
      this.renderHarmonicTimeline();
      this.renderAt(0, true);
    } catch (error) {
      if (generation !== this.generation) return;
      console.error(error);
      this.status.textContent = "ERROR";
      this.fieldEl.textContent = error.message;
      this.sourceNote.textContent = `${error.message} Some protected/DRM library tracks cannot be opened by a web browser.`;
    }
  }

  renderHarmonicTimeline() {
    if (!this.harmonyCard || !this.audioHarmony?.segments?.length) {
      if (this.harmonyCard) this.harmonyCard.hidden = true;
      return;
    }
    this.harmonyCard.hidden = false;
    this.harmonyTrack.innerHTML = "";
    this.harmonySegmentEls = [];
    const totalDuration = Math.max(this.duration || 0, this.audioHarmony.segments.at(-1)?.end || 1);
    for (const segment of this.audioHarmony.segments) {
      const button = create("button", "audio-harmony-segment");
      button.type = "button";
      button.dataset.segmentIndex = String(segment.index);
      button.title = `${segment.symbol} · ${segment.onset.toFixed(2)}–${segment.end.toFixed(2)} s · inferred`;
      button.style.flexGrow = String(Math.max(0.25, segment.duration / totalDuration * 20));
      button.append(
        create("span", "audio-harmony-segment-symbol", segment.symbol),
        create("span", "audio-harmony-segment-time", `${segment.onset.toFixed(1)}s`)
      );
      button.addEventListener("click", () => this.seekTo(segment.onset));
      this.harmonyTrack.appendChild(button);
      this.harmonySegmentEls.push(button);
    }
    const context = this.audioHarmony.harmonicAnalysis?.contextualFunction?.hypotheses?.[0] || null;
    const contextText = context ? `${pitchClassName(context.centerPc)} ${context.systemName}` : "context unresolved";
    this.harmonySummary.textContent = `${this.audioHarmony.segmentCount} stable segments · ${contextText} · chord/root/quality inferred · bass unavailable in chroma v1.`;
  }

  renderHarmonicAt(timeSeconds) {
    const segments = this.audioHarmony?.segments;
    if (!segments?.length || !this.harmonyCard) return;
    let segment = segments.find((item) => timeSeconds >= item.onset && timeSeconds < item.end);
    if (!segment) segment = timeSeconds >= segments.at(-1).end ? segments.at(-1) : segments[0];
    for (let i = 0; i < this.harmonySegmentEls.length; i += 1) {
      this.harmonySegmentEls[i].classList.toggle("is-current", i === segment.index);
    }
    this.harmonyCurrent.textContent = segment.symbol;
    const functionCandidate = this.audioHarmony.harmonicAnalysis?.contextualFunction?.hypotheses?.[0]?.functions?.[segment.index]?.candidates?.[0] || null;
    this.harmonyFunction.textContent = functionCandidate
      ? `${functionCandidate.roman} · ${functionCandidate.nashville} · ${functionCandidate.role} · relative harmonic interpretation`
      : `Root/quality support ${Math.round(segment.support * 100)}% · no stable functional reading`;
    const alternatives = segment.candidates.slice(1, 4);
    this.harmonyAlternatives.textContent = alternatives.length
      ? `Alternatives: ${alternatives.map((candidate) => `${candidate.symbol} ${Math.round(candidate.relativeWeight * 100)}%`).join(" · ")} · relative weights, not probabilities`
      : "No competing chord candidate retained.";
  }

  renderAt(timeSeconds, force = false) {
    if (!this.currentTrack) return;
    if (!force && Math.abs(timeSeconds - this.lastRenderTime) < 1 / 45) return;
    this.lastRenderTime = timeSeconds;

    const activity = computePitchClassActivity(this.notes, timeSeconds, this.currentTrack.analysis?.activity);
    let activeField = this.activeField;
    let currentFieldLabel = this.currentTrack.analysis?.field?.name || "Defined field";
    let candidates = inferScaleCandidates(activity.raw, 4);
    const adaptive = this.currentTrack.analysis?.mode === "adaptive";

    if (adaptive) {
      const previousPcs = this.currentCollection?.pcs || this.activeField;
      const state = inferCollectionCenterState(activity.raw, previousPcs, {
        switchMargin: 0.065,
        retainFloor: 0.52,
        limit: 12
      });

      if (state.collection) this.currentCollection = state.collection;
      if (this.currentCollection) {
        activeField = this.currentCollection.pcs;
        this.activeField = [...activeField];
        this.shadowField = complementField(activeField);
        currentFieldLabel = this.currentCollection.label;
        candidates = this.currentCollection.centers;
      }
      if (this.primaryDiagnosticLabel) this.primaryDiagnosticLabel.textContent = "CURRENT COLLECTION";
    } else if (this.primaryDiagnosticLabel) {
      this.primaryDiagnosticLabel.textContent = "CURRENT FIELD";
    }

    const shadowField = complementField(activeField);
    const admissions = computeAdmissionHistory(this.notes, shadowField, timeSeconds);
    const latentCenter = this.currentTrack.analysis?.latentCenter;
    const crystallization = crystallizationSupport({
      activityNormalized: activity.normalized,
      shadowField,
      admittedPcs: admissions.admittedPcs,
      latentCenter
    });

    const circleLabel = adaptive ? currentFieldLabel.replace(/ collection$/i, "") : currentFieldLabel;
    this.pitchCircle.update({
      activeField,
      activity,
      events: this.notes,
      timeSeconds,
      fieldLabel: circleLabel,
      crystallization
    });

    this.fieldEl.textContent = currentFieldLabel;
    this.activeEl.textContent = fieldLabel(activeField);
    this.shadowEl.textContent = fieldLabel(shadowField);
    this.admissionsEl.textContent = admissions.ordered.length
      ? admissions.ordered.map((x) => `${x.name}${x.persistent ? "•" : ""}`).join(" → ")
      : "—";

    const expected = this.currentTrack.analysis?.shadowAdmissionOrder;
    if (expected?.length) {
      const order = compareAdmissionOrder(admissions.admittedPcs, expected);
      this.orderEl.textContent = order.complete
        ? "Canonical admission sequence complete."
        : order.exactSoFar
          ? `Matches canonical order through ${order.matchedPrefix}/${expected.length}.`
          : `Observed order diverges after ${order.matchedPrefix}/${expected.length}.`;
    } else {
      this.orderEl.textContent = `${admissions.uniqueCount}/${admissions.shadowSize} shadow classes admitted.`;
    }

    this.candidatesEl.innerHTML = "";
    for (const candidate of candidates.slice(0, 4)) {
      const row = create("div", "candidate-row");
      const label = create("span", "candidate-label", candidate.label);
      const bar = create("span", "candidate-bar");
      const fill = create("span", "candidate-fill");
      const weight = Number(candidate.relativeWeight ?? candidate.confidence ?? 0);
      fill.style.width = `${Math.max(2, weight * 100)}%`;
      bar.appendChild(fill);
      const pct = create("span", "candidate-pct", `${Math.round(weight * 100)}%`);
      row.append(label, bar, pct);
      this.candidatesEl.appendChild(row);
    }

    if (crystallization) {
      this.crystallizationEl.textContent = `${pitchClassName(latentCenter)} candidate · ${Math.round(crystallization.score * 100)}% support`;
    } else if (adaptive && this.currentCollection?.centers?.length) {
      const lead = this.currentCollection.centers[0];
      this.crystallizationEl.textContent = `${lead.label} leads within the current collection`;
    } else {
      this.crystallizationEl.textContent = "No latent center specified";
    }

    this.duration = Math.max(this.duration, Number.isFinite(this.audio.duration) ? this.audio.duration - Number(this.currentTrack.audioOffset || 0) : 0);
    const s = Math.max(0, timeSeconds);
    const d = Math.max(0, this.duration);
    const format = (seconds) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
    this.timeEl.textContent = `${format(s)} / ${format(d)}`;
    this.seek.value = String(Math.round(1000 * Math.min(1, this.duration ? timeSeconds / this.duration : 0)));
    this.timeline.update({ duration: this.duration || 1, time: timeSeconds, admissions: admissions.ordered });
    this.renderHarmonicAt(timeSeconds);
  }
}
