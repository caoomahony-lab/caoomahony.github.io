import { HolographicHarmonyApp } from "./app.js";
import { complementField, fieldLabel, validatePartition } from "../theory/fields.js";
import { computePitchClassActivity } from "../theory/activity.js";
import { computeAdmissionHistory, compareAdmissionOrder } from "../theory/admissions.js";
import { inferScaleCandidates, crystallizationSupport } from "../theory/inference.js";
import { inferCollectionCenterState } from "../inference/collection-center.js";
import { inferAudioHarmonySegments } from "../inference/audio-harmony.js";
import { inferScoreHarmony } from "../inference/score-harmony.js";
import { compareAudioToScore } from "../validation/audio-score-comparison.js";
import { parseMusicXML } from "../music/musicxml.js";
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
    this.scoreHarmony = null;
    this.audioReferenceScore = null;
    this.audioScoreComparison = null;
    this.harmonyRegionEls = [];
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
    this.harmonyTitle = create("div", "timeline-title", "HARMONIC REGION TIMELINE");
    this.harmonyEvidence = create("div", "audio-harmony-evidence", "INFERRED FROM AUDIO");
    heading.append(this.harmonyTitle, this.harmonyEvidence);
    const now = create("div", "audio-harmony-now");
    this.harmonyCurrent = create("div", "audio-harmony-current", "—");
    this.harmonyFunction = create("div", "audio-harmony-function", "No audio segmentation loaded.");
    this.harmonyAlternatives = create("div", "audio-harmony-alternatives", "");
    now.append(this.harmonyCurrent, this.harmonyFunction, this.harmonyAlternatives);
    this.referenceControls = create("div", "audio-reference-controls");
    this.referenceControls.hidden = true;
    this.referenceScoreButton = create("button", "audio-reference-button", "Load matching score");
    this.referenceScoreButton.type = "button";
    this.referenceScoreButton.setAttribute("aria-label", "Load matching MusicXML score for local comparison");
    this.referenceScoreInput = document.createElement("input");
    this.referenceScoreInput.type = "file";
    this.referenceScoreInput.accept = ".musicxml,.xml,application/vnd.recordare.musicxml+xml,application/xml,text/xml";
    this.referenceScoreInput.className = "audio-reference-input";
    this.referenceScoreInput.setAttribute("aria-label", "Choose matching MusicXML score");
    this.referenceStatus = create("div", "audio-reference-status", "Optional: compare this inferred audio timeline with measured score notes.");
    this.referenceResults = create("div", "audio-reference-results");
    this.referenceResults.hidden = true;
    this.referenceControls.append(
      this.referenceScoreButton,
      this.referenceScoreInput,
      this.referenceStatus,
      this.referenceResults
    );
    this.referenceScoreButton.addEventListener("click", () => this.referenceScoreInput.click());
    this.referenceScoreInput.addEventListener("change", async () => {
      const file = this.referenceScoreInput.files?.[0] || null;
      this.referenceScoreInput.value = "";
      if (file) await this.loadAudioReferenceScore(file);
    });
    this.harmonyTrack = create("div", "audio-harmony-track audio-harmony-region-track");
    this.harmonyTrack.setAttribute("aria-label", "Inferred harmonic regions");
    this.harmonyDetail = create("details", "audio-harmony-detail");
    this.harmonyDetailSummary = create("summary", "audio-harmony-detail-summary", "Micro-segment detail");
    this.harmonyMicroTrack = create("div", "audio-harmony-track audio-harmony-micro-track");
    this.harmonyMicroTrack.setAttribute("aria-label", "Inferred harmonic micro-segments");
    this.harmonyDetail.append(this.harmonyDetailSummary, this.harmonyMicroTrack);
    this.harmonySummary = create("div", "audio-harmony-summary", "");
    this.harmonyCard.append(heading, now, this.referenceControls, this.harmonyTrack, this.harmonyDetail, this.harmonySummary);
    const footer = this.root.querySelector(".hhv-footer");
    if (footer) this.root.insertBefore(this.harmonyCard, footer);
    else this.root.appendChild(this.harmonyCard);
  }

  beginLoad(status = "LOADING") {
    const generation = super.beginLoad(status);
    this.currentCollection = null;
    this.audioHarmony = null;
    this.scoreHarmony = null;
    this.audioReferenceScore = null;
    this.audioScoreComparison = null;
    this.harmonyRegionEls = [];
    this.harmonySegmentEls = [];
    if (this.harmonyCard) this.harmonyCard.hidden = true;
    if (this.harmonyTrack) this.harmonyTrack.innerHTML = "";
    if (this.harmonyMicroTrack) this.harmonyMicroTrack.innerHTML = "";
    if (this.referenceControls) this.referenceControls.hidden = true;
    if (this.referenceResults) {
      this.referenceResults.hidden = true;
      this.referenceResults.innerHTML = "";
    }
    if (this.referenceStatus) this.referenceStatus.textContent = "Optional: compare this inferred audio timeline with measured score notes.";
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
        analysis: Object.freeze({
          mode: "adaptive",
          audioHarmonyVersion: harmony.version,
          registeredNoteVersion: analysis.registeredNoteVersion
        })
      });
      this.audio.src = this.localObjectUrl;
      this.audio.currentTime = 0;
      this.audio.load();
      this.duration = analysis.durationSeconds;
      this.playButton.disabled = false;
      this.status.textContent = "READY";
      this.clearScoreExport(
        `Registered-note beta: ${analysis.registeredNoteEvents.length} inferred note events with octave/register across ${Math.round(analysis.registeredFrameShare * 100)}% of analysis frames. Audio → MusicXML remains disabled until rhythm/voice quantization is reliable.`
      );
      this.sourceNote.textContent = `${file.name} · analyzed locally · ${analysis.frameCount} frames · ${analysis.registeredNoteEvents.length} inferred registered-note events · ${harmony.segmentCount} inferred micro-segments → ${harmony.regionCount} inferred harmonic regions. Nothing was uploaded by Harmonic Savant.`;
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

  async loadAudioReferenceScore(file) {
    if (!this.audioHarmony?.regions?.length || this.currentTrack?.id !== LOCAL_TRACK_ID) {
      this.referenceStatus.textContent = "Open and finish analyzing a local audio file first.";
      return;
    }

    const generation = this.generation;
    this.referenceScoreButton.disabled = true;
    this.referenceStatus.textContent = `Parsing ${file.name} locally and comparing timelines…`;

    try {
      const xml = await file.text();
      if (generation !== this.generation) return;
      const parsed = parseMusicXML(xml, globalThis.DOMParser, {
        trackId: `reference:${file.name}`
      });
      if (generation !== this.generation) return;
      const scoreHarmony = inferScoreHarmony(parsed.notes);
      if (!scoreHarmony.regions.length) throw new Error("The reference score did not produce sounding sonority regions.");
      const comparison = compareAudioToScore(
        this.audioHarmony.regions,
        scoreHarmony.regions,
        { microSegmentCount: this.audioHarmony.segmentCount }
      );
      if (generation !== this.generation) return;

      this.audioReferenceScore = scoreHarmony;
      this.audioScoreComparison = comparison;
      this.referenceStatus.textContent = `${file.name} · processed locally · nothing uploaded.`;
      this.renderAudioScoreComparison();
    } catch (error) {
      if (generation !== this.generation) return;
      console.error(error);
      this.audioReferenceScore = null;
      this.audioScoreComparison = null;
      this.referenceResults.hidden = true;
      this.referenceResults.innerHTML = "";
      this.referenceStatus.textContent = `Reference comparison failed: ${error.message}`;
    } finally {
      if (generation === this.generation) this.referenceScoreButton.disabled = false;
    }
  }

  renderAudioScoreComparison() {
    const comparison = this.audioScoreComparison;
    if (!comparison || !this.referenceResults) return;
    const percent = (value) => value == null ? "unavailable" : `${Math.round(value * 100)}%`;
    const seconds = (value) => `${Number(value || 0).toFixed(2)} s`;
    const offset = comparison.estimatedAudioMinusScoreOffsetSeconds;
    const rows = [
      ["Estimated audio − score offset", `${offset >= 0 ? "+" : ""}${seconds(offset)}`],
      ["Root agreement", percent(comparison.agreement.timeWeightedRootAgreement)],
      ["Pitch-set overlap", percent(comparison.agreement.timeWeightedPitchSetJaccard)],
      ["Exact pitch-set agreement", percent(comparison.agreement.timeWeightedExactPitchSetAgreement)],
      ["Chord-template agreement", percent(comparison.agreement.timeWeightedChordTemplateAgreement)],
      ["Boundary precision / recall", `${percent(comparison.boundaries.precision)} / ${percent(comparison.boundaries.recall)}`],
      ["Audio coverage", percent(comparison.coverage.audioCoverageShare)],
      ["Unresolved audio", seconds(comparison.coverage.unresolvedAudioSeconds)],
      ["Local timing drift", comparison.localAlignment
        ? `${seconds(comparison.localAlignment.minimumOffsetSeconds)} … ${seconds(comparison.localAlignment.maximumOffsetSeconds)} across ${comparison.localAlignment.knotCount} windows`
        : "unavailable"],
      ["Timeline counts", `${comparison.counts.microSegmentCount} micro → ${comparison.counts.audioRegionCount} regions ↔ ${comparison.counts.scoreReferenceRegionCount} score references`]
    ];

    this.referenceResults.innerHTML = "";
    const grid = create("dl", "audio-reference-grid");
    for (const [label, value] of rows) {
      grid.append(
        create("dt", "audio-reference-label", label),
        create("dd", "audio-reference-value", value)
      );
    }
    this.referenceResults.appendChild(grid);

    if (comparison.rootConfusions.length) {
      const summary = comparison.rootConfusions.slice(0, 4)
        .map((item) => `score pc ${item.scoreRootPc} → audio pc ${item.audioRootPc} (${item.seconds.toFixed(2)} s)`)
        .join(" · ");
      this.referenceResults.appendChild(create("div", "audio-reference-confusions", `Leading root mismatches: ${summary}`));
    }
    this.referenceResults.appendChild(create(
      "div",
      "audio-reference-note",
      "Measured reference: score notes and lowest sounding MIDI. Inferred layers: score chord labels, audio regions, roots/functions, and global/local time alignment. Local alignment is validation-only. Relative weights are not probabilities."
    ));
    this.referenceResults.hidden = false;
  }

  async loadLocalScore(file) {
    await super.loadLocalScore(file);
    if (
      this.currentTrack?.id !== LOCAL_TRACK_ID ||
      this.currentTrack?.title !== file.name ||
      !this.notes?.length
    ) return;

    try {
      this.scoreHarmony = inferScoreHarmony(this.notes);
      const format = this.currentTrack?.scoreSourceFormat || "musicxml";
      const sourceMeaning = format === "midi"
        ? "pitch/timing/velocity are encoded MIDI events; chord/root/function labels are inferred"
        : "note content and bass are measured from MusicXML; chord/root/function labels are inferred";
      this.sourceNote.textContent = `${file.name} · ${this.notes.length} note events · ${this.scoreHarmony.regionCount} sonority regions · ${sourceMeaning}. MusicXML export is ready. Playback requires audio.`;
      this.renderHarmonicTimeline();
      this.renderHarmonicAt(0);
    } catch (error) {
      console.error(error);
      this.status.textContent = "ERROR";
      this.fieldEl.textContent = error.message;
      this.sourceNote.textContent = error.message;
    }
  }

  renderTimelineButtons(items, target, elementList, { kind, seekable }) {
    target.innerHTML = "";
    elementList.length = 0;
    const totalDuration = Math.max(
      this.duration || 0,
      items.at(-1)?.end || 1
    );
    for (const item of items) {
      const button = create("button", `audio-harmony-segment audio-harmony-${kind}`);
      button.type = "button";
      button.dataset.timelineIndex = String(item.index);
      const evidence = kind === "score-region"
        ? "measured notes; interpreted chord"
        : "inferred from audio";
      button.title = `${item.symbol || "unresolved"} · ${item.onset.toFixed(2)}–${item.end.toFixed(2)} s · ${evidence}`;
      button.style.flexGrow = String(Math.max(0.25, item.duration / totalDuration * 20));
      button.append(
        create("span", "audio-harmony-segment-symbol", item.symbol || "—"),
        create("span", "audio-harmony-segment-time", `${item.onset.toFixed(1)}s`)
      );
      if (seekable) button.addEventListener("click", () => this.seekTo(item.onset));
      else button.disabled = true;
      target.appendChild(button);
      elementList.push(button);
    }
  }

  renderHarmonicTimeline() {
    const scoreRegions = this.scoreHarmony?.regions || [];
    const audioRegions = this.audioHarmony?.regions || [];
    const microSegments = this.audioHarmony?.segments || [];
    if (!scoreRegions.length && !audioRegions.length && !microSegments.length) {
      if (this.harmonyCard) this.harmonyCard.hidden = true;
      return;
    }

    this.harmonyCard.hidden = false;
    this.harmonyRegionEls = [];
    this.harmonySegmentEls = [];

    if (scoreRegions.length) {
      this.harmonyTitle.textContent = "SCORE SONORITY REFERENCE · measured states, interpreted chords";
      this.harmonyEvidence.textContent = "MEASURED SCORE / INFERRED LABELS";
      this.harmonyDetail.hidden = true;
      this.referenceControls.hidden = true;
      this.renderTimelineButtons(scoreRegions, this.harmonyTrack, this.harmonyRegionEls, {
        kind: "score-region",
        seekable: false
      });
      this.harmonySummary.textContent = `${scoreRegions.length} score sonority regions · pitch sets and lowest sounding MIDI are measured · chord/root/function labels are inferred.`;
      return;
    }

    const primary = audioRegions.length ? audioRegions : microSegments;
    this.harmonyTitle.textContent = "AUDIO HARMONIC TIMELINE · inferred regions";
    this.harmonyEvidence.textContent = "INFERRED FROM AUDIO";
    this.referenceControls.hidden = false;
    this.harmonyDetail.hidden = !audioRegions.length;
    this.renderTimelineButtons(primary, this.harmonyTrack, this.harmonyRegionEls, {
      kind: "region",
      seekable: true
    });
    if (audioRegions.length) {
      this.renderTimelineButtons(microSegments, this.harmonyMicroTrack, this.harmonySegmentEls, {
        kind: "micro-segment",
        seekable: true
      });
      this.harmonyDetailSummary.textContent = `Micro-segment detail (${microSegments.length})`;
    }
    const context = (this.audioHarmony.regionHarmonicAnalysis || this.audioHarmony.harmonicAnalysis)
      ?.contextualFunction?.hypotheses?.[0] || null;
    const contextText = context ? `${pitchClassName(context.centerPc)} ${context.systemName}` : "context unresolved";
    const bassText = this.audioHarmony?.regions?.some((region) => region.bassPc != null)
      ? "bass inferred when low-frequency evidence is confident"
      : "bass unresolved/ambiguous";
    this.harmonySummary.textContent = `${microSegments.length} micro-segments → ${primary.length} harmonic regions · ${contextText} · chord/root/quality inferred · ${bassText}.`;
  }

  renderHarmonicAt(timeSeconds) {
    if (!this.harmonyCard) return;
    if (this.scoreHarmony?.regions?.length) {
      const regions = this.scoreHarmony.regions;
      let region = regions.find((item) => timeSeconds >= item.onset && timeSeconds < item.end);
      if (!region) region = timeSeconds >= regions.at(-1).end ? regions.at(-1) : regions[0];
      for (let index = 0; index < this.harmonyRegionEls.length; index += 1) {
        this.harmonyRegionEls[index].classList.toggle("is-current", index === region.index);
      }
      this.harmonyCurrent.textContent = region.symbol || "—";
      const functionCandidate = this.scoreHarmony.harmonicAnalysis
        ?.contextualFunction?.hypotheses?.[0]?.functions?.[region.index]?.candidates?.[0] || null;
      this.harmonyFunction.textContent = functionCandidate
        ? `${functionCandidate.roman} · ${functionCandidate.nashville} · ${functionCandidate.role} · inferred interpretation of measured score notes`
        : "Measured sonority retained · no stable functional reading";
      const alternatives = region.candidates.slice(1, 4);
      this.harmonyAlternatives.textContent = alternatives.length
        ? `Interpretive alternatives: ${alternatives.map((candidate) => candidate.symbol).join(" · ")}`
        : "No competing chord interpretation retained.";
      return;
    }

    const regions = this.audioHarmony?.regions?.length
      ? this.audioHarmony.regions
      : this.audioHarmony?.segments;
    if (!regions?.length) return;
    let region = regions.find((item) => timeSeconds >= item.onset && timeSeconds < item.end);
    if (!region) region = timeSeconds >= regions.at(-1).end ? regions.at(-1) : regions[0];
    for (let index = 0; index < this.harmonyRegionEls.length; index += 1) {
      this.harmonyRegionEls[index].classList.toggle("is-current", index === region.index);
    }
    const microSegments = this.audioHarmony.segments || [];
    const micro = microSegments.find((item) => timeSeconds >= item.onset && timeSeconds < item.end) || null;
    for (let index = 0; index < this.harmonySegmentEls.length; index += 1) {
      this.harmonySegmentEls[index].classList.toggle("is-current", micro?.index === index);
    }
    this.harmonyCurrent.textContent = region.symbol || "—";
    const analysis = this.audioHarmony.regions?.length
      ? this.audioHarmony.regionHarmonicAnalysis
      : this.audioHarmony.harmonicAnalysis;
    const functionCandidate = analysis
      ?.contextualFunction?.hypotheses?.[0]?.functions?.[region.index]?.candidates?.[0] || null;
    this.harmonyFunction.textContent = functionCandidate
      ? `${functionCandidate.roman} · ${functionCandidate.nashville} · ${functionCandidate.role} · relative harmonic interpretation`
      : `Root/quality support ${Math.round(Number(region.support ?? region.candidates?.[0]?.regionSupport ?? 0) * 100)}% · no stable functional reading`;
    const alternatives = (region.candidates || []).slice(1, 4);
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
