import { buildContinuationSession } from "../continuation/session.js";
import { CONTINUATION_WEIGHT_PRESETS } from "../continuation/rank.js";
import { CONTINUATION_SCORE_DIMENSIONS } from "../continuation/score-candidate.js";
import { SCALE_SYSTEMS } from "../inference/scales.js";
import { pitchClassName } from "../theory/pitch.js";

const DIMENSION_LABELS = Object.freeze({
  functional: "Function",
  voiceLeading: "Voice leading",
  corpusFrequency: "Corpus",
  styleSimilarity: "Style",
  novelty: "Novelty",
  holographicContinuity: "Holographic"
});

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function field(label, control, help = "") {
  const wrap = el("label", "hs-field");
  wrap.append(el("span", "hs-field-label", label), control);
  if (help) wrap.append(el("span", "hs-field-help", help));
  return wrap;
}

function option(value, label) {
  const node = document.createElement("option");
  node.value = value;
  node.textContent = label;
  return node;
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : "—";
}

function midiName(midi) {
  const pc = ((midi % 12) + 12) % 12;
  return `${pitchClassName(pc)}${Math.floor(midi / 12) - 1}`;
}

function serializeSession(session) {
  return JSON.stringify(session, null, 2);
}

export class ContinuationPanel {
  constructor(root, { getHolographicContext = null } = {}) {
    if (!root) throw new TypeError("ContinuationPanel requires a root element");
    this.root = root;
    this.getHolographicContext = getHolographicContext;
    this.session = null;
    this.build();
    this.bind();
  }

  build() {
    this.root.classList.add("hs-continuation-panel");
    this.root.innerHTML = "";

    const heading = el("div", "hs-panel-heading");
    const title = el("div");
    title.append(el("div", "eyebrow", "HARMONIC SAVANT · CONTINUE"), el("h2", "hs-title", "Function, voicing & continuation lab"));
    this.engineBadge = el("div", "status-pill", "HHF-3");
    heading.append(title, this.engineBadge);

    const intro = el("p", "hs-intro", "Enter your own progression. Functional language, target-key translation and continuation objectives all come from the tested core engine; this panel adds no separate theory rules.");

    this.progression = document.createElement("textarea");
    this.progression.className = "hs-textarea";
    this.progression.rows = 2;
    this.progression.value = "Cmaj7 | E7/G# | Am9 | Fmaj7";
    this.progression.spellcheck = false;

    this.contextTonic = document.createElement("input");
    this.contextTonic.className = "hs-input";
    this.contextTonic.placeholder = "blank = infer";
    this.contextTonic.autocomplete = "off";

    this.system = document.createElement("select");
    for (const system of SCALE_SYSTEMS) this.system.append(option(system.id, system.name));

    this.targetTonic = document.createElement("input");
    this.targetTonic.className = "hs-input";
    this.targetTonic.placeholder = "e.g. F#, Bb";
    this.targetTonic.autocomplete = "off";

    this.voicing = document.createElement("input");
    this.voicing.className = "hs-input";
    this.voicing.placeholder = "e.g. G2 D3 G3 B3";
    this.voicing.autocomplete = "off";

    this.preset = document.createElement("select");
    this.preset.append(option("", "No composite ranking"));
    for (const name of Object.keys(CONTINUATION_WEIGHT_PRESETS)) this.preset.append(option(name, name));

    this.missingPolicy = document.createElement("select");
    this.missingPolicy.append(option("renormalize", "Renormalize available evidence"), option("zero", "Missing evidence = zero"), option("require", "Require every weighted dimension"));

    this.useCurrentField = document.createElement("input");
    this.useCurrentField.type = "checkbox";
    this.useCurrentField.checked = true;
    const fieldToggle = el("label", "hs-checkbox");
    fieldToggle.append(this.useCurrentField, el("span", "", "Use current visualizer active/shadow field when available"));

    const grid = el("div", "hs-form-grid");
    const progressionField = field("Chord progression", this.progression, "Use |, comma, semicolon, newline, or spaces for simple symbols.");
    progressionField.classList.add("hs-field-wide");
    grid.append(
      progressionField,
      field("Context tonic", this.contextTonic, "Leave blank to preserve competing inferred contexts."),
      field("System", this.system, "Used when a context tonic is declared."),
      field("Translate to key", this.targetTonic, "Optional functional re-rendering."),
      field("Current voicing", this.voicing, "Optional note names or MIDI; enables registered voice-leading."),
      field("Ranking preset", this.preset, "Visible preset only; blank means no composite ranking."),
      field("Missing evidence", this.missingPolicy, "Applies only when a ranking preset is selected.")
    );

    const actions = el("div", "hs-actions");
    this.runButton = el("button", "hs-primary", "Analyze & continue");
    this.runButton.type = "button";
    this.exportButton = el("button", "hs-secondary", "Copy JSON");
    this.exportButton.type = "button";
    this.exportButton.disabled = true;
    this.actionStatus = el("span", "hs-action-status", "");
    actions.append(this.runButton, this.exportButton, this.actionStatus);

    this.output = el("div", "hs-output");
    this.output.append(el("div", "hs-empty", "No continuation session yet."));

    this.root.append(heading, intro, grid, fieldToggle, actions, this.output);
  }

  bind() {
    this.runButton.addEventListener("click", () => this.run());
    this.exportButton.addEventListener("click", async () => {
      if (!this.session) return;
      const text = serializeSession(this.session);
      try {
        await navigator.clipboard.writeText(text);
        this.actionStatus.textContent = "JSON copied";
      } catch {
        this.actionStatus.textContent = "Clipboard unavailable; JSON is still available in the session API.";
      }
    });
  }

  run() {
    this.actionStatus.textContent = "";
    this.runButton.disabled = true;
    try {
      const holographic = this.useCurrentField.checked ? this.getHolographicContext?.() : null;
      const preset = this.preset.value || null;
      const ranking = preset ? {
        preset,
        missingPolicy: this.missingPolicy.value,
        limit: 12
      } : null;
      this.session = buildContinuationSession({
        progression: this.progression.value,
        currentVoicing: this.voicing.value,
        contextTonic: this.contextTonic.value,
        systemId: this.system.value,
        targetTonic: this.targetTonic.value,
        activeField: holographic?.activeField ?? null,
        shadowField: holographic?.shadowField ?? null,
        ranking,
        candidateOptions: { maxCandidates: 48 },
        scoringOptions: { voiceLeading: { maxVoicingCandidates: 240, maxSearchNodes: 30000 } }
      });
      this.exportButton.disabled = false;
      this.render(this.session);
    } catch (error) {
      console.error(error);
      this.session = null;
      this.exportButton.disabled = true;
      this.output.innerHTML = "";
      const box = el("div", "hs-error");
      box.append(el("strong", "", "Input could not be analyzed."), el("div", "", error?.message || String(error)));
      this.output.append(box);
    } finally {
      this.runButton.disabled = false;
    }
  }

  render(session) {
    this.output.innerHTML = "";
    this.output.append(this.renderContext(session), this.renderProgression(session), this.renderCandidates(session));
    const note = el("div", "hs-evidence-note");
    note.textContent = session.notes.join(" ");
    this.output.append(note);
  }

  renderContext(session) {
    const card = el("section", "hs-result-card");
    card.append(el("div", "hs-result-title", "Tonal context"));
    const primary = el("div", "hs-context-primary", `${session.context.centerName} ${session.context.systemName}`);
    const source = el("span", "hs-evidence-chip", session.context.source === "declared" ? "DECLARED" : "INFERRED");
    primary.append(" ", source);
    card.append(primary);
    if (session.context.source === "inferred") {
      const hypotheses = el("div", "hs-hypotheses");
      for (const hypothesis of session.context.hypotheses.slice(0, 4)) {
        const row = el("div", "hs-hypothesis-row");
        row.append(el("span", "", `${pitchClassName(hypothesis.centerPc)} ${hypothesis.systemName}`), el("span", "", `relative weight ${pct(hypothesis.relativeWeight)}`));
        hypotheses.append(row);
      }
      card.append(hypotheses, el("div", "hs-small-note", "Relative weights compare current hypotheses only; they are not calibrated probabilities."));
    }
    return card;
  }

  renderProgression(session) {
    const card = el("section", "hs-result-card");
    card.append(el("div", "hs-result-title", "Functional translation"));
    const table = el("div", "hs-function-table");
    const header = el("div", "hs-function-row hs-function-header");
    header.append(el("span", "", "Input"), el("span", "", "Roman"), el("span", "", "Nashville"), el("span", "", session.input.targetTonic ? `In ${session.input.targetTonic}` : "Target key"), el("span", "", "Beginner"));
    table.append(header);
    for (const row of session.progression) {
      const line = el("div", "hs-function-row");
      line.append(
        el("span", "hs-chord-symbol", row.sourceSymbol),
        el("span", "", row.function?.roman ?? "—"),
        el("span", "", row.function?.nashville ?? "—"),
        el("span", "", row.function?.targetKeyChord ?? "—"),
        el("span", "hs-beginner", row.function?.beginner ?? "No stable interpretation")
      );
      table.append(line);
    }
    card.append(table);
    return card;
  }

  renderCandidates(session) {
    const card = el("section", "hs-result-card");
    const title = session.ranking ? `Continuations · ${session.ranking.preset || "custom weights"}` : "Continuation candidates · unranked";
    card.append(el("div", "hs-result-title", title));

    const byCandidate = new Map(session.candidates.map((entry) => [entry.candidate, entry]));
    const ordered = session.ranking
      ? session.ranking.rankings.map((ranked) => ({ entry: byCandidate.get(ranked.candidate), ranked }))
      : session.candidates.slice(0, 12).map((entry) => ({ entry, ranked: null }));

    if (!ordered.length) {
      card.append(el("div", "hs-empty", "No eligible continuation candidates under the current constraints."));
      return card;
    }

    const list = el("div", "hs-candidate-list");
    for (const { entry, ranked } of ordered) {
      if (!entry) continue;
      const row = el("article", "hs-continuation-row");
      const head = el("div", "hs-continuation-head");
      const identity = el("div", "hs-continuation-identity");
      const label = entry.presentation.targetKeyChord || entry.presentation.symbol || entry.presentation.roman || "Pitch-set candidate";
      identity.append(el("strong", "hs-continuation-symbol", label));
      const functionText = [entry.presentation.roman, entry.presentation.nashville].filter(Boolean).join(" · ");
      if (functionText) identity.append(el("span", "hs-continuation-function", functionText));
      head.append(identity);
      if (ranked) head.append(el("div", "hs-weighted-score", `#${ranked.rank} · objective ${pct(ranked.combinedScore)}`));
      row.append(head);

      if (entry.presentation.beginner) row.append(el("div", "hs-candidate-explanation", entry.presentation.beginner));
      const sources = el("div", "hs-source-chips");
      for (const source of entry.presentation.sources) sources.append(el("span", "hs-source-chip", source));
      row.append(sources);

      const scores = el("div", "hs-score-grid");
      for (const dimension of CONTINUATION_SCORE_DIMENSIONS) {
        const record = entry.dimensions[dimension];
        const box = el("div", `hs-score ${record.available ? "" : "is-unavailable"}`);
        box.append(el("span", "hs-score-label", DIMENSION_LABELS[dimension]), el("strong", "hs-score-value", record.available ? pct(record.score) : "—"));
        if (ranked && ranked.contributions[dimension]?.requestedWeight > 0) {
          box.append(el("span", "hs-score-weight", `w ${ranked.contributions[dimension].requestedWeight}`));
        }
        scores.append(box);
      }
      row.append(scores);

      const voice = entry.dimensions.voiceLeading;
      if (voice.available && voice.bestVoicing?.length) {
        row.append(el("div", "hs-best-voicing", `Closest voicing: ${voice.bestVoicing.map(midiName).join(" · ")} · ${voice.movementSemitones} total semitones movement`));
      }
      list.append(row);
    }
    card.append(list);
    if (!session.ranking) card.append(el("div", "hs-small-note", "These are generated possibilities in deterministic source order. Choose a visible ranking preset to combine objectives."));
    return card;
  }
}
