import { SCORE_COMPARISON_VERSION, SCORE_COMPONENTS, validateScoreComparison } from "../similarity/score-comparison.js";
import { ReferenceCatalogPanel } from "./reference-catalog-panel.js";
import { browserStorage } from "./browser-storage.js";
import { harmonicAnalysisCard } from "./harmonic-analysis-card.js";
import { assertScoreHIR } from "../model/harmonic-ir.js";
import { validateHIRFingerprint } from "../fingerprint/hir-extract.js";

export const SCORE_LIBRARY_KEY = "harmonic-savant:score-library:v1";
const create = (tag, className = "", text = "") => {
  const element = document.createElement(tag);
  element.className = className; element.textContent = text; return element;
};
const format = value => value == null ? "Unavailable" : value.toFixed(3);
const downloadJson = (value, name) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = create("a"); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export class ScoreComparisonPanel {
  constructor(root, { storage = undefined, onAnalysisReady = null, workerFactory = () => new Worker(new URL("../similarity/score-comparison-worker.js", import.meta.url), { type: "module" }) } = {}) {
    this.root = root; this.storage = storage === undefined ? browserStorage() : storage; this.workerFactory = workerFactory;
    this.current = null; this.analysis = null; this.audioTitle = null; this.onAnalysisReady = onAnalysisReady; this.worker = null; this.requestId = 0; this.pending = new Map();
    this.sourceGeneration = 0; this.comparisonGeneration = 0; this.latestComparisons = [];
    this.corpus = this.read(); this.build(); this.renderCurrent();
  }
  read() {
    this.storageReadError = null;
    try {
      const records = JSON.parse(this.storage?.getItem(SCORE_LIBRARY_KEY) || "[]");
      if (!Array.isArray(records)) throw new Error("saved score library is not a list");
      const valid = records.filter(record => typeof record?.id === "string" && typeof record.title === "string" && validateScoreComparison(record.scoreDescriptor));
      if (valid.length !== records.length) this.storageReadError = "Saved score library contains unreadable records; it has been preserved.";
      return valid;
    } catch {
      this.storageReadError = "Saved score library could not be read; it has been preserved.";
      return [];
    }
  }
  request(type, input) {
    if (!this.worker) {
      this.worker = this.workerFactory();
      this.worker.onmessage = ({ data }) => {
        const pending = this.pending.get(data.id); if (!pending) return;
        this.pending.delete(data.id);
        if (data.error) pending.reject(new Error(data.error)); else pending.resolve(data.result);
      };
      this.worker.onerror = event => {
        for (const pending of this.pending.values()) pending.reject(new Error(event.message || "Local score worker failed"));
        this.pending.clear(); this.worker?.terminate(); this.worker = null;
      };
    }
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try { this.worker.postMessage({ ...input, id, type }); }
      catch (error) { this.pending.delete(id); reject(error); }
    });
  }
  invalidate({ audioTitle = null } = {}) {
    this.sourceGeneration++; this.comparisonGeneration++; this.current = null; this.analysis = null;
    this.audioTitle = audioTitle;
    this.latestComparisons = []; this.worker?.terminate(); this.worker = null;
    for (const pending of this.pending.values()) pending.reject(new Error("Source changed"));
    this.pending.clear(); this.renderCurrent(); this.results.replaceChildren();
  }
  setAudioSource({ title }) {
    this.root.hidden = false;
    this.invalidate({ audioTitle: String(title || "Current audio") });
  }
  build() {
    this.root.className = "fingerprint-explorer score-comparison-panel";
    this.root.setAttribute("aria-label", "Score comparison");
    const header = create("div", "fingerprint-head");
    header.append(create("h2", "timeline-title", "SCORE COMPARISON · EXPERIMENTAL"));
    this.save = create("button", "fingerprint-save", "Save score"); this.save.type = "button"; this.save.onclick = () => this.saveCurrent();
    this.export = create("button", "fingerprint-save", "Export fingerprint JSON"); this.export.type = "button";
    this.export.onclick = () => this.current && downloadJson({ exportVersion: "score-comparison-export-v1", ...this.current }, "Harmonic_Savant_Fingerprint.json");
    header.append(this.save, this.export); this.root.append(header);
    this.status = create("div", "score-comparison-status"); this.status.setAttribute("aria-live", "polite"); this.root.append(this.status);
    this.currentCard = create("section", "fingerprint-current"); this.root.append(this.currentCard);
    const controls = create("div", "score-comparison-controls");
    const rankLabel = create("label", "pairwise-mode", "Rank by "); this.rankBy = create("select"); this.rankBy.setAttribute("aria-label", "Rank score comparisons by");
    for (const component of SCORE_COMPONENTS) { const option = create("option", "", component.label); option.value = component.key; this.rankBy.append(option); }
    this.rankBy.onchange = () => this.renderComparisons(); rankLabel.append(this.rankBy);
    const targetLabel = create("label", "pairwise-mode", "Compare with "); this.target = create("select"); this.target.setAttribute("aria-label", "Saved score to compare");
    this.target.onchange = () => this.renderComparisons(); targetLabel.append(this.target);
    this.report = create("button", "fingerprint-save", "Export comparison JSON"); this.report.type = "button";
    this.report.onclick = () => downloadJson({ exportVersion: "score-comparison-report-v1", source: this.current?.scoreDescriptor.sourceId, definitions: SCORE_COMPONENTS, comparisons: this.latestComparisons }, "Harmonic_Savant_Comparisons.json");
    controls.append(rankLabel, targetLabel, this.report); this.root.append(controls);
    this.results = create("div", "fingerprint-results"); this.root.append(this.results);
    const catalogRoot = create("section"); this.root.append(catalogRoot);
    this.catalogPanel = new ReferenceCatalogPanel(catalogRoot, { request: (type, input) => this.request(type, input),
      renderComparison: (item, target) => this.renderCard(item, target), download: downloadJson });
    const definitions = create("details", "fingerprint-custom"); definitions.append(create("summary", "", "Distance definitions and limits"));
    definitions.append(create("p", "score-comparison-copy", "Distances range from 0 to 1: 0 means equal for that defined feature. These are experimental mathematical distances, not probabilities or percentages of shared music. Ranking uses the selected component, with one displayed global transposition. Missing evidence stays unavailable. The first-64-region opening is a separate scope, never a substitute for whole-score order."));
    for (const component of SCORE_COMPONENTS) { const paragraph = create("p", "score-comparison-copy"); paragraph.append(create("strong", "", component.label + ": "), document.createTextNode(component.definition)); definitions.append(paragraph); }
    definitions.append(create("p", "score-comparison-copy", "Files and saved fingerprints stay in this browser. Source notes are never changed. Audio comparisons retain their separate inferred-evidence method. A complete sonority-order calculation is bounded at 48 million cell updates; very long pairs can be unavailable. This release does not provide matched-phrase search or a complete functional/voice-leading fingerprint."));
    this.root.append(definitions);
  }
  renderCurrent() {
    this.catalogPanel?.setCurrent(this.current);
    this.currentCard.replaceChildren(); this.save.disabled = !this.current; this.export.disabled = !this.current; this.report.disabled = true;
    this.status.textContent = "";
    if (!this.current) {
      if (this.audioTitle) {
        this.currentCard.append(create("div", "fingerprint-empty-title", "Reference catalog available · matching score needed"),
          create("p", "score-comparison-copy", `${this.audioTitle} is open as audio. Load its matching MusicXML with “Load matching score” above to enable score and catalog comparisons while the recording stays open. You can also open MusicXML, MXL or MIDI using the score picker. Audio analysis remains available below.`));
      } else {
        this.currentCard.append(create("div", "fingerprint-empty-title", "Open a score to compare its measured musical evidence"), create("p", "score-comparison-copy", "MusicXML, MXL and MIDI are analyzed locally. Save a score, then open another to compare pitch, bass, rhythm and harmonic order."));
      }
    } else {
      const descriptor = this.current.scoreDescriptor;
      if (this.audioTitle) this.currentCard.append(create("p", "score-comparison-copy", `Comparisons use this matching score's measured notes. ${this.audioTitle} remains open for inferred audio analysis.`));
      this.currentCard.append(create("div", "fingerprint-piece-title", this.current.title),
        create("div", "fingerprint-evidence", descriptor.provenance.sourceFormat === "midi" ? "ENCODED MIDI NOTES · CHORD INTERPRETATIONS INFERRED" : "MEASURED SCORE NOTES · CHORD INTERPRETATIONS INFERRED"),
        create("p", "score-comparison-copy", `${descriptor.counts.notes} notes · ${descriptor.counts.attacks} exact attacks · ${descriptor.counts.regions} sounding sonority regions · ${descriptor.counts.ambiguousRegions} regions with tied chord interpretations.`),
        create("p", "score-comparison-copy", "Pitch sets and sounding bass are measured. The upper-note line is an attack proxy, not verified melody. No single overall similarity percentage is assigned."));
      if (this.analysis?.hir) this.currentCard.append(harmonicAnalysisCard(this.analysis, downloadJson));
      else if (this.analysis?.advancedError) this.currentCard.append(create("p", "pairwise-warning", `Expanded harmonic analysis unavailable: ${this.analysis.advancedError}. Existing comparisons remain available.`));
    }
    const previous = this.target.value;
    this.target.replaceChildren(); const automatic = create("option", "", "Nearest saved scores"); automatic.value = ""; this.target.append(automatic);
    for (const piece of this.availablePieces()) { const option = create("option", "", piece.title); option.value = piece.id; this.target.append(option); }
    this.target.value = [...this.target.options].some(option => option.value === previous) ? previous : "";
    this.target.disabled = !this.current || !this.availablePieces().length;
    this.rankBy.disabled = !this.current;
  }
  availablePieces() { return this.corpus.filter(piece => piece.scoreDescriptor.sourceId !== this.current?.scoreDescriptor.sourceId); }
  async accept({ title, events, sourceId, sourceFormat, analysisOptions = {}, audioReference = false }) {
    this.root.hidden = false;
    if (!audioReference) this.audioTitle = null;
    const generation = this.sourceGeneration;
    this.status.textContent = "Analyzing score evidence locally…";
    try {
      const analysis = await this.request("analyze", { events, options: { ...analysisOptions, sourceId, sourceFormat } });
      if (generation !== this.sourceGeneration) return;
      const { scoreDescriptor, hir, fingerprint } = analysis;
      if (!validateScoreComparison(scoreDescriptor) || scoreDescriptor.sourceId !== sourceId) throw new Error("Analysis source does not match the current score");
      if (hir && (assertScoreHIR(hir).source.id !== sourceId || !validateHIRFingerprint(fingerprint) || fingerprint.sourceId !== sourceId)) throw new Error("Incompatible shared harmonic analysis");
      this.analysis = analysis;
      this.current = Object.freeze({ title: String(title || "Untitled score"), scoreDescriptor });
      if (hir) this.onAnalysisReady?.(hir);
      this.renderCurrent(); await this.renderComparisons();
    } catch (error) { if (generation === this.sourceGeneration) this.status.textContent = `Score comparison unavailable: ${error.message}`; }
  }
  saveCurrent() {
    if (!this.current) return;
    if (typeof this.storage?.getItem === "function") this.corpus = this.read();
    if (this.storageReadError) { this.status.textContent = `Could not save locally: ${this.storageReadError}`; return; }
    const item = { ...this.current, id: `score:${this.current.scoreDescriptor.sourceId}`, savedAt: new Date().toISOString() };
    const next = this.corpus.filter(piece => piece.id !== item.id).concat(item);
    try {
      if (!this.storage) throw new Error("browser storage is unavailable");
      this.storage.setItem(SCORE_LIBRARY_KEY, JSON.stringify(next));
      this.corpus = next; this.renderCurrent(); this.status.textContent = "Score saved in this browser."; this.renderComparisons();
    } catch (error) { this.status.textContent = `Could not save locally: ${error.message}. Export fingerprint JSON to keep a copy.`; }
  }
  async renderComparisons() {
    const generation = ++this.comparisonGeneration;
    this.results.replaceChildren(); this.latestComparisons = []; this.report.disabled = true;
    if (!this.current) return;
    let pieces = this.availablePieces();
    if (this.target.value) pieces = pieces.filter(piece => piece.id === this.target.value);
    if (!pieces.length) { this.results.append(create("p", "score-comparison-copy", "Save this score, then open a different score. Your saved audio fingerprints remain available when you open audio.")); return; }
    const rankBy = this.rankBy.value;
    this.results.append(create("p", "score-comparison-copy", "Comparing saved score evidence locally…"));
    try {
      const output = await this.request("compare", { current: this.current.scoreDescriptor, pieces, options: { rankBy } });
      if (generation !== this.comparisonGeneration) return;
      const records = new Map(pieces.map(piece => [piece.id, piece]));
      const ranked = output.map(item => ({ ...item, title: records.get(item.id).title })).sort((a, b) =>
        (a.comparison.distance ?? Infinity) - (b.comparison.distance ?? Infinity) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
      this.latestComparisons = ranked; this.report.disabled = false; this.results.replaceChildren();
      this.results.append(create("p", "score-comparison-copy", `Ranked by ${SCORE_COMPONENTS.find(component => component.key === rankBy).label.toLowerCase()} distance. Lower means closer for this feature. Other components remain independently visible.`));
      for (const item of ranked.slice(0, 5)) this.renderCard(item);
    } catch (error) { if (generation === this.comparisonGeneration) this.results.replaceChildren(create("p", "pairwise-warning", `Comparison unavailable: ${error.message}`)); }
  }
  renderCard({ title, comparison, reference }, target = this.results) {
    const card = create("article", "pairwise-card score-comparison-card");
    card.append(create("h3", "score-comparison-title", title), create("p", "score-comparison-copy", `Transpose compared score by ${comparison.shiftBToA} semitones. Alignment selected by ${comparison.shiftCriterion}. Every pitch-dependent component uses this shift.`));
    if (reference) {
      const metadata = create("p", "score-comparison-copy", `${reference.composer || "Composer unspecified"} · ${reference.instruments.join(", ") || "Instrument unspecified"} · ${reference.genres.join(", ") || "Genre unspecified"} · PDMX catalog metadata. `);
      const link = create("a", "", "Reference source"); link.href = "https://zenodo.org/records/15571083"; link.target = "_blank"; link.rel = "noopener noreferrer";
      metadata.append(link); card.append(metadata);
    }
    const table = create("table", "score-distance-table"), head = create("thead"), heading = create("tr");
    for (const text of ["Component", "Distance", "Evidence"]) { const cell = create("th", "", text); cell.scope = "col"; heading.append(cell); }
    head.append(heading); table.append(head); const body = create("tbody");
    for (const component of SCORE_COMPONENTS) { const row = create("tr"), label = create("th", "", component.label); label.scope = "row";
      row.append(label, create("td", "score-distance-value", format(comparison.components[component.key])), create("td", "score-evidence-cell", component.evidence)); body.append(row); }
    table.append(body); card.append(table);
    for (const explanation of comparison.explanations) card.append(create("p", "score-comparison-copy", explanation));
    const order = comparison.order;
    card.append(create("p", order.distance == null ? "pairwise-warning" : "pairwise-order", order.distance == null
      ? `Whole-score order unavailable (${order.reason}). The opening below is a separate result.`
      : `Whole-score order: ${order.edits} edit(s) across ${order.regionsA}/${order.regionsB} regions.`));
    const opening = comparison.opening;
    card.append(create("p", "score-comparison-copy", `Opening only: ${format(opening.distance)} over ${opening.regionsA}/${opening.regionsB} regions · shift ${opening.shiftBToA ?? "unavailable"}. First 64 sounding regions; not a matched phrase.`));
    const overlay = create("details", "score-overlay"); overlay.append(create("summary", "", "Pitch-content overlay at this transposition"));
    const chart = create("div", "score-overlay-grid");
    const labels = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
    for (let pc = 0; pc < 12; pc++) { const column = create("div", "score-overlay-column");
      const a = comparison.overlays.pitchA[pc], b = comparison.overlays.pitchB[pc];
      column.append(create("span", "score-overlay-label", labels[pc]));
      for (const [value, className, source] of [[a, "score-overlay-current", "Current"], [b, "score-overlay-saved", "Saved"]]) {
        const meter = create("div", "score-overlay-meter"), bar = create("span", className); bar.style.height = `${value * 100}%`; meter.title = `${source} ${labels[pc]}: ${(value * 100).toFixed(2)}% of note-duration mass`; meter.setAttribute("aria-label", meter.title); meter.append(bar); column.append(meter);
      }
      chart.append(column);
    }
    overlay.append(create("p", "score-comparison-copy", "Blue: current score. Gold: compared score, transposed. Heights are shares of summed note durations, not similarity percentages."), chart); card.append(overlay); target.append(card);
  }
}
