import { SCORE_COMPONENTS } from "../similarity/score-comparison.js";
import { validateReferenceCatalog, validateCatalogDescriptor } from "../corpus/reference-catalog.js";
import { browserStorage } from "./browser-storage.js";

const manifestUrl = new URL("../../public/catalog/pdmx-v9/manifest.json", import.meta.url);
const create = (tag, className = "", text = "") => {
  const element = document.createElement(tag); element.className = className; element.textContent = text; return element;
};
const label = (text, control) => { const element = create("label", "pairwise-mode", text); element.append(control); return element; };
const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))))
  .map(byte => byte.toString(16).padStart(2, "0")).join("");

export class ReferenceCatalogPanel {
  constructor(root, { request, renderComparison, download, fetchImpl = (...args) => fetch(...args) }) {
    this.root = root; this.request = request; this.renderComparison = renderComparison; this.download = download; this.fetch = fetchImpl;
    this.current = undefined; this.catalog = null; this.loading = false; this.generation = 0; this.shards = new Map(); this.latestReport = null;
    this.storage = browserStorage(); this.preferences = {};
    try { const saved = JSON.parse(this.storage?.getItem("harmonic-savant:catalog-filters:v1") || "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) this.preferences = saved;
    } catch { /* Catalog browsing also works with unavailable storage. */ }
    this.build(); this.setCurrent(null);
  }
  build() {
    this.root.className = "reference-catalog"; this.root.setAttribute("aria-label", "Reference music catalog");
    const header = create("div", "fingerprint-head"); header.append(create("h3", "timeline-title", "REFERENCE MUSIC · PDMX PILOT"));
    this.loadButton = create("button", "fingerprint-save", "Load reference catalog"); this.loadButton.type = "button"; this.loadButton.onclick = () => this.load();
    header.append(this.loadButton); this.root.append(header);
    this.root.append(create("p", "score-comparison-copy", "Compare this score with a selected public reference library. Your music is analyzed locally; catalog requests download public fingerprints, without sending your score or search terms."));
    this.status = create("p", "score-comparison-copy"); this.status.setAttribute("aria-live", "polite"); this.root.append(this.status);
    this.controls = create("div", "score-comparison-controls reference-catalog-controls");
    this.query = create("input"); this.query.type = "search"; this.query.maxLength = 300; this.query.placeholder = "Title, composer or tag"; this.query.setAttribute("aria-label", "Search reference music");
    this.query.value = typeof this.preferences.query === "string" ? this.preferences.query.slice(0, 300) : "";
    this.composer = create("select"); this.composer.setAttribute("aria-label", "Reference composer");
    this.genre = create("select"); this.genre.setAttribute("aria-label", "Reference genre");
    this.instrument = create("select"); this.instrument.setAttribute("aria-label", "Reference instrument");
    this.rankBy = create("select"); this.rankBy.setAttribute("aria-label", "Rank reference comparisons by");
    for (const component of SCORE_COMPONENTS) { const option = create("option", "", component.label); option.value = component.key; this.rankBy.append(option); }
    this.rankBy.value = "pitchContent";
    if (SCORE_COMPONENTS.some(component => component.key === this.preferences.rankBy)) this.rankBy.value = this.preferences.rankBy;
    this.controls.append(label("Search ", this.query), label("Composer ", this.composer), label("Genre ", this.genre), label("Instrument ", this.instrument), label("Rank by ", this.rankBy));
    this.compareButton = create("button", "fingerprint-save", "Compare with catalog"); this.compareButton.type = "button"; this.compareButton.onclick = () => this.search();
    this.exportButton = create("button", "fingerprint-save", "Export catalog comparisons"); this.exportButton.type = "button";
    this.exportButton.onclick = () => this.latestReport && this.download(this.latestReport, "Harmonic_Savant_Catalog_Comparisons.json");
    this.controls.append(this.compareButton, this.exportButton); this.root.append(this.controls);
    for (const select of [this.composer, this.genre, this.instrument]) { const option = create("option", "", "All"); option.value = ""; select.append(option); }
    for (const control of [this.query, this.composer, this.genre, this.instrument, this.rankBy]) control.onchange = () => this.clearResults();
    this.query.oninput = () => this.clearResults(); this.query.onkeydown = event => { if (event.key === "Enter") this.search(); };
    this.results = create("div", "fingerprint-results"); this.root.append(this.results);
    this.attribution = create("p", "score-comparison-copy reference-catalog-attribution"); this.root.append(this.attribution);
  }
  setCurrent(current) {
    if (this.current === current) return;
    this.current = current; this.clearResults(); this.updateControls();
  }
  clearResults() {
    if (this.catalog) this.persistFilters?.();
    this.generation++; this.latestReport = null; this.results.replaceChildren(); this.exportButton.disabled = true;
    this.status.textContent = this.catalog ? `${this.catalog.count} reference scores ready. ${this.current ? "Choose filters, then compare." : "Open a score to compare."}`
      : "Load the reference catalog to enable external comparisons.";
    this.updateControls();
  }
  updateControls(busy = false) {
    for (const control of [this.query, this.composer, this.genre, this.instrument, this.rankBy].filter(Boolean)) control.disabled = !this.catalog || !this.current;
    this.compareButton.disabled = busy || !this.catalog || !this.current; this.loadButton.disabled = this.loading || Boolean(this.catalog);
  }
  async load() {
    if (this.loading || this.catalog) return;
    this.loading = true; this.updateControls(); this.status.textContent = "Loading public reference fingerprints…";
    try {
      const response = await this.fetch(manifestUrl);
      if (!response.ok) throw new Error(`catalog download returned ${response.status}`);
      const catalog = await response.json();
      if (!validateReferenceCatalog(catalog)) throw new Error("catalog version, source metadata or distributions are incompatible");
      this.catalog = catalog;
      for (const [control, field, first, preference] of [[this.composer, "composer", "All composers", "composer"], [this.genre, "genres", "All genres", "genre"], [this.instrument, "instruments", "All instruments", "instrument"]]) {
        control.replaceChildren(); const option = create("option", "", first); option.value = ""; control.append(option);
        const values = [...new Set(catalog.records.flatMap(record => record[field]))].filter(Boolean).sort((a, b) => a.localeCompare(b));
        for (const value of values) { const item = create("option", "", value); item.value = value; control.append(item); }
        if (values.includes(this.preferences[preference])) control.value = this.preferences[preference];
      }
      this.loadButton.textContent = "Reference catalog loaded";
      this.attribution.append(document.createTextNode(`PDMX ${catalog.source.release} · Phillip Long, Zachary Novack, Julian McAuley and Taylor Berg-Kirkpatrick · catalog metadata CC BY 4.0. Source scores carry public-domain labels with no recorded license conflict. ${catalog.source.selection} `));
      const source = create("a", "", "Dataset and source details"); source.href = "https://zenodo.org/records/15571083"; source.target = "_blank"; source.rel = "noopener noreferrer";
      this.attribution.append(source);
    } catch (error) { this.status.textContent = `Reference catalog unavailable: ${error.message}. Try loading again.`; }
    finally { this.loading = false; this.updateControls(); }
    if (this.catalog) { this.clearResults(); if (this.current) await this.search(); }
  }
  persistFilters() {
    const preferences = { query: this.query.value, composer: this.composer?.value || "", genre: this.genre.value, instrument: this.instrument.value, rankBy: this.rankBy.value };
    this.preferences = preferences;
    try { this.storage?.setItem("harmonic-savant:catalog-filters:v1", JSON.stringify(preferences)); } catch { /* Filters still apply for this session. */ }
  }
  async loadShard(record) {
    if (!this.shards.has(record.descriptorFile)) {
      const promise = (async () => {
        const response = await this.fetch(new URL(record.descriptorFile, manifestUrl));
        if (!response.ok) throw new Error(`reference fingerprint download returned ${response.status}`);
        const text = await response.text();
        if (await digest(text) !== record.descriptorSha256) throw new Error("reference fingerprint checksum mismatch");
        const shard = JSON.parse(text);
        if (shard.catalogId !== this.catalog.id || shard.version !== this.catalog.version || !Array.isArray(shard.records)) throw new Error("reference fingerprint shard is incompatible");
        return new Map(shard.records.map(item => [item.id, item.scoreDescriptor]));
      })();
      this.shards.set(record.descriptorFile, promise);
      promise.catch(() => this.shards.delete(record.descriptorFile));
    }
    const descriptors = await this.shards.get(record.descriptorFile), descriptor = descriptors.get(record.id);
    if (!validateCatalogDescriptor(record, descriptor)) throw new Error("reference fingerprint does not match its catalog summary");
    return descriptor;
  }
  async search() {
    if (!this.current || !this.catalog) return;
    const generation = ++this.generation, current = this.current;
    this.latestReport = null; this.results.replaceChildren(); this.exportButton.disabled = true; this.updateControls(true);
    const options = { rankBy: this.rankBy.value, query: this.query.value, composer: this.composer?.value || "", genre: this.genre.value, instrument: this.instrument.value };
    this.status.textContent = `Searching ${this.catalog.count} reference fingerprints locally…`;
    try {
      const selection = await this.request("catalog-shortlist", { current: current.scoreDescriptor, catalog: this.catalog, options });
      if (generation !== this.generation) return;
      if (!selection.items.length) {
        this.status.textContent = selection.filteredRecords ? `No comparable ${options.rankBy} evidence in ${selection.filteredRecords} filtered reference scores.` : "No reference scores match these filters. Try a broader title, genre or instrument.";
        return;
      }
      const byId = new Map(this.catalog.records.map(record => [record.id, record]));
      this.status.textContent = `Comparing all eight components for ${selection.items.length} leading candidates…`;
      const pieces = await Promise.all(selection.items.map(async item => {
        const reference = byId.get(item.id); return { id: item.id, reference, scoreDescriptor: await this.loadShard(reference) };
      }));
      if (generation !== this.generation) return;
      const output = await this.request("compare", { current: current.scoreDescriptor, pieces, options: { rankBy: options.rankBy } });
      if (generation !== this.generation) return;
      const ranked = output.map(item => ({ ...item, reference: byId.get(item.id), title: byId.get(item.id).title }))
        .sort((a, b) => (a.comparison.distance ?? Infinity) - (b.comparison.distance ?? Infinity) || a.id.localeCompare(b.id));
      this.status.textContent = `${selection.filteredRecords} filtered scores · ${selection.comparableRecords} with usable ${selection.shortlistBy} evidence. ${selection.note} Showing up to five results. Catalog metadata and arrangements are not verified recording identities.`;
      this.latestReport = { exportVersion: "reference-catalog-comparisons-v1", current: { title: current.title, sourceId: current.scoreDescriptor.sourceId },
        catalogId: this.catalog.id, source: this.catalog.source, selection, comparisons: ranked, limitations: "Experimental score comparisons; no recording, artist-style aggregate or passage-match claim. Private score notes are not included." };
      for (const [index, item] of ranked.slice(0, 5).entries()) {
        const details = create("details", "reference-result"); details.open = index === 0;
        const summary = create("summary", "", `${index + 1}. ${item.title} · ${item.comparison.distance == null ? "Unavailable" : item.comparison.distance.toFixed(3)} ${SCORE_COMPONENTS.find(component => component.key === options.rankBy).label.toLowerCase()} distance`);
        const body = create("div"); details.append(summary, body); this.results.append(details); this.renderComparison(item, body);
      }
      this.exportButton.disabled = false;
    } catch (error) { if (generation === this.generation) this.status.textContent = `Catalog comparison unavailable: ${error.message}`; }
    finally { if (generation === this.generation) this.updateControls(); }
  }
}
