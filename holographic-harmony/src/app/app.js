import { parseMusicXML } from "../music/musicxml.js";
import { complementField, fieldLabel, validatePartition } from "../theory/fields.js";
import { computePitchClassActivity } from "../theory/activity.js";
import { computeAdmissionHistory, compareAdmissionOrder } from "../theory/admissions.js";
import { inferScaleCandidates, crystallizationSupport } from "../theory/inference.js";
import { pitchClassName } from "../theory/pitch.js";
import { PitchCircle } from "../visualization/pitch-circle.js";
import { HolographicTimeline } from "../visualization/timeline.js";

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

function create(tag, className, text = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

export class HolographicHarmonyApp {
  constructor(root, tracks) {
    this.root = root;
    this.tracks = tracks;
    this.generation = 0;
    this.abortController = null;
    this.raf = null;
    this.notes = [];
    this.currentTrack = null;
    this.activeField = [];
    this.shadowField = [];
    this.duration = 0;
    this.lastRenderTime = -1;
    this.buildUI();
    this.bindEvents();
  }

  buildUI() {
    this.root.innerHTML = "";
    this.root.classList.add("hhv-app");

    const header = create("header", "hhv-header");
    const heading = create("div", "hhv-heading");
    heading.append(create("div", "eyebrow", "HOLOGRAPHIC HARMONY"), create("h1", "", "Active / Shadow Field Visualizer"));
    this.status = create("div", "status-pill", "READY");
    header.append(heading, this.status);

    const controls = create("section", "controls-panel");
    const selectorWrap = create("label", "track-selector");
    selectorWrap.append(create("span", "control-label", "Composition"));
    this.trackSelect = create("select", "");
    for (const track of this.tracks) {
      const option = document.createElement("option");
      option.value = track.id;
      option.textContent = track.title;
      this.trackSelect.appendChild(option);
    }
    selectorWrap.appendChild(this.trackSelect);

    this.modeBadge = create("div", "mode-badge", "PAPER MODE");
    controls.append(selectorWrap, this.modeBadge);

    const visualGrid = create("section", "visual-grid");
    const circleCard = create("div", "circle-card");
    const circleHost = create("div", "circle-host");
    circleCard.appendChild(circleHost);
    this.pitchCircle = new PitchCircle(circleHost);

    const side = create("aside", "diagnostics");
    side.innerHTML = `
      <div class="diag-block"><div class="diag-label">CURRENT FIELD</div><div class="diag-value" data-field>—</div></div>
      <div class="diag-block"><div class="diag-label">ACTIVE F</div><div class="diag-notes" data-active>—</div></div>
      <div class="diag-block"><div class="diag-label">SHADOW S</div><div class="diag-notes shadow" data-shadow>—</div></div>
      <div class="diag-block"><div class="diag-label">ADMISSIONS</div><div class="diag-notes" data-admissions>—</div><div class="diag-sub" data-order></div></div>
      <div class="diag-block"><div class="diag-label">CENTER CANDIDATES</div><div data-candidates></div></div>
      <div class="diag-block"><div class="diag-label">CRYSTALLIZATION</div><div class="diag-value" data-crystallization>—</div><div class="diag-sub">Interpretive candidate, not a measured fact.</div></div>
    `;
    this.fieldEl = side.querySelector("[data-field]");
    this.activeEl = side.querySelector("[data-active]");
    this.shadowEl = side.querySelector("[data-shadow]");
    this.admissionsEl = side.querySelector("[data-admissions]");
    this.orderEl = side.querySelector("[data-order]");
    this.candidatesEl = side.querySelector("[data-candidates]");
    this.crystallizationEl = side.querySelector("[data-crystallization]");
    visualGrid.append(circleCard, side);

    const transport = create("section", "transport");
    this.playButton = create("button", "play-button", "▶");
    this.playButton.type = "button";
    this.timeEl = create("div", "time-readout", "0:00 / 0:00");
    this.seek = document.createElement("input");
    this.seek.type = "range";
    this.seek.min = "0";
    this.seek.max = "1000";
    this.seek.value = "0";
    this.seek.className = "seek";
    transport.append(this.playButton, this.seek, this.timeEl);

    const timelineCard = create("section", "timeline-card");
    const timelineTitle = create("div", "timeline-title", "FIELD TIMELINE · shadow admissions marked above line");
    this.timelineCanvas = create("canvas", "timeline-canvas");
    timelineCard.append(timelineTitle, this.timelineCanvas);

    this.audio = document.createElement("audio");
    this.audio.preload = "metadata";

    const footer = create("footer", "hhv-footer");
    footer.textContent = "Measured pitch facts and exact set relations are separated from tonal interpretation.";

    this.root.append(header, controls, visualGrid, transport, timelineCard, this.audio, footer);
    this.timeline = new HolographicTimeline(this.timelineCanvas, (seconds) => this.seekTo(seconds));
  }

  bindEvents() {
    this.trackSelect.addEventListener("change", () => this.loadTrack(this.trackSelect.value));
    this.playButton.addEventListener("click", async () => {
      if (!this.currentTrack) return;
      if (this.audio.paused) {
        await this.audio.play();
      } else {
        this.audio.pause();
      }
    });
    this.seek.addEventListener("input", () => {
      const ratio = Number(this.seek.value) / 1000;
      this.seekTo(ratio * this.duration);
    });
    this.audio.addEventListener("play", () => {
      this.playButton.textContent = "❚❚";
      this.startAnimation();
    });
    this.audio.addEventListener("pause", () => {
      this.playButton.textContent = "▶";
      this.stopAnimation();
      this.renderAt(this.audio.currentTime || 0, true);
    });
    this.audio.addEventListener("ended", () => {
      this.playButton.textContent = "▶";
      this.stopAnimation();
      this.renderAt(this.duration, true);
    });
  }

  async initialize() {
    await this.loadTrack(this.trackSelect.value || this.tracks[0].id);
  }

  async loadTrack(trackId) {
    const track = this.tracks.find((t) => t.id === trackId);
    if (!track) throw new Error(`Unknown track: ${trackId}`);

    const generation = ++this.generation;
    this.stopAnimation();
    this.audio.pause();
    this.abortController?.abort();
    this.abortController = new AbortController();
    this.status.textContent = "LOADING";
    this.currentTrack = null;
    this.notes = [];
    this.activeField = [];
    this.shadowField = [];
    this.duration = 0;
    this.resetDiagnostics();

    try {
      const scoreResponse = await fetch(track.score, { signal: this.abortController.signal });
      if (!scoreResponse.ok) throw new Error(`Score load failed (${scoreResponse.status})`);
      const xml = await scoreResponse.text();
      if (generation !== this.generation) return;
      const parsed = parseMusicXML(xml);
      if (generation !== this.generation) return;

      this.notes = parsed.notes;
      const paperField = track.analysis?.field?.pcs;
      if (paperField?.length) this.activeField = [...paperField];
      else {
        const initialActivity = computePitchClassActivity(this.notes, Math.min(6, parsed.durationSeconds));
        this.activeField = inferScaleCandidates(initialActivity.raw, 1)[0]?.pcs || [0, 2, 4, 5, 7, 9, 11];
      }
      this.shadowField = complementField(this.activeField);
      const partition = validatePartition(this.activeField, this.shadowField);
      if (!partition.valid) throw new Error("Active/shadow partition failed Z12 invariant");

      this.currentTrack = track;
      this.modeBadge.textContent = track.analysis?.mode === "adaptive" ? "ADAPTIVE MODE" : "PAPER MODE";
      this.audio.src = track.audio;
      this.audio.currentTime = 0;
      this.audio.load();
      this.duration = Math.max(parsed.durationSeconds, Number(track.durationHint || 0));
      this.status.textContent = "READY";
      this.renderAt(0, true);
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error(error);
      this.status.textContent = "ERROR";
      this.fieldEl.textContent = error.message;
    }
  }

  resetDiagnostics() {
    this.fieldEl.textContent = "—";
    this.activeEl.textContent = "—";
    this.shadowEl.textContent = "—";
    this.admissionsEl.textContent = "—";
    this.orderEl.textContent = "";
    this.candidatesEl.innerHTML = "";
    this.crystallizationEl.textContent = "—";
    this.seek.value = "0";
    this.timeEl.textContent = "0:00 / 0:00";
    this.timeline?.update({ duration: 1, time: 0, admissions: [] });
  }

  seekTo(seconds) {
    if (!this.currentTrack) return;
    const bounded = Math.max(0, Math.min(this.duration || 0, seconds || 0));
    const offset = Number(this.currentTrack.audioOffset || 0);
    if (Number.isFinite(this.audio.duration)) {
      this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, bounded + offset));
    }
    this.renderAt(bounded, true);
  }

  scoreTime() {
    const offset = Number(this.currentTrack?.audioOffset || 0);
    return Math.max(0, (this.audio.currentTime || 0) - offset);
  }

  startAnimation() {
    this.stopAnimation();
    const generation = this.generation;
    const tick = () => {
      if (generation !== this.generation || this.audio.paused) return;
      this.renderAt(this.scoreTime());
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stopAnimation() {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  renderAt(timeSeconds, force = false) {
    if (!this.currentTrack) return;
    if (!force && Math.abs(timeSeconds - this.lastRenderTime) < 1 / 45) return;
    this.lastRenderTime = timeSeconds;

    const activity = computePitchClassActivity(this.notes, timeSeconds, this.currentTrack.analysis?.activity);
    let activeField = this.activeField;
    let currentFieldLabel = this.currentTrack.analysis?.field?.name || "Defined field";
    const candidates = inferScaleCandidates(activity.raw, 4);

    if (this.currentTrack.analysis?.mode === "adaptive" && candidates.length) {
      activeField = candidates[0].pcs;
      this.activeField = activeField;
      this.shadowField = complementField(activeField);
      currentFieldLabel = candidates[0].label;
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

    this.pitchCircle.update({
      activeField,
      activity,
      events: this.notes,
      timeSeconds,
      fieldLabel: currentFieldLabel,
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
    for (const candidate of candidates.slice(0, 3)) {
      const row = create("div", "candidate-row");
      const label = create("span", "candidate-label", candidate.label);
      const bar = create("span", "candidate-bar");
      const fill = create("span", "candidate-fill");
      fill.style.width = `${Math.max(2, candidate.confidence * 100)}%`;
      bar.appendChild(fill);
      const pct = create("span", "candidate-pct", `${Math.round(candidate.confidence * 100)}%`);
      row.append(label, bar, pct);
      this.candidatesEl.appendChild(row);
    }

    if (crystallization) {
      this.crystallizationEl.textContent = `${pitchClassName(latentCenter)} candidate · ${Math.round(crystallization.score * 100)}% support`;
    } else {
      this.crystallizationEl.textContent = "No latent center specified";
    }

    this.duration = Math.max(this.duration, Number.isFinite(this.audio.duration) ? this.audio.duration - Number(this.currentTrack.audioOffset || 0) : 0);
    this.timeEl.textContent = `${formatTime(timeSeconds)} / ${formatTime(this.duration)}`;
    this.seek.value = String(Math.round(1000 * Math.min(1, this.duration ? timeSeconds / this.duration : 0)));
    this.timeline.update({ duration: this.duration || 1, time: timeSeconds, admissions: admissions.ordered });
  }
}
