import { HolographicHarmonyApp } from "./app.js";
import { complementField, fieldLabel } from "../theory/fields.js";
import { computePitchClassActivity } from "../theory/activity.js";
import { computeAdmissionHistory, compareAdmissionOrder } from "../theory/admissions.js";
import { inferScaleCandidates, crystallizationSupport } from "../theory/inference.js";
import { inferCollectionCenterState } from "../inference/collection-center.js";
import { pitchClassName } from "../theory/pitch.js";

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
  }

  buildUI() {
    super.buildUI();
    this.primaryDiagnosticLabel = this.fieldEl?.parentElement?.querySelector(".diag-label") || null;
    const centerLabel = this.candidatesEl?.parentElement?.querySelector(".diag-label");
    if (centerLabel) centerLabel.textContent = "CENTER / MODE HYPOTHESES";
  }

  beginLoad(status = "LOADING") {
    const generation = super.beginLoad(status);
    this.currentCollection = null;
    if (this.primaryDiagnosticLabel) this.primaryDiagnosticLabel.textContent = "CURRENT FIELD";
    return generation;
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
  }
}
