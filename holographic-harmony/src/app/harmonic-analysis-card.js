import { pitchClassName } from "../theory/pitch.js";

const rows = [
  ["Pitch ecology", "Relative pitch usage and concentration", "measured under reference"],
  ["Bass gravity", "Lowest sounding pitch and anchoring", "measured under reference"],
  ["Interval spectrum", "Simultaneous pitch-class intervals", "measured"],
  ["Chord vocabulary", "Set classes and chord-template distribution", "measured + inferred"],
  ["Chord transitions", "Function-state transitions and n-grams", "under inferred functions"],
  ["Root motion", "Directed and unsigned root intervals", "under inferred roots"],
  ["Modal profile", "Whole-score center/system hypothesis weights", "inferred summary"],
  ["Chromatic strategy", "Outside-field durations, repeats and episodes", "under reference field"],
  ["Register and texture", "Pitch span, density and outer-voice separation", "measured"]
];
const make = (tag, text = "", className = "") => {
  const element = document.createElement(tag); element.textContent = text; element.className = className; return element;
};

export function harmonicAnalysisCard(analysis, download) {
  const details = make("details", "", "fingerprint-custom harmonic-analysis");
  details.append(make("summary", "Harmonic analysis · nine feature blocks"));
  const { hir, fingerprint } = analysis;
  const reference = hir.selectedReferenceCenter;
  details.append(make("p", `${hir.events.length} original note events retained · ${hir.harmonicWindows.length} sounding windows · normalization reference ${pitchClassName(reference.pc)} (${reference.source === "declared-reference" ? "supplied" : "inferred"}${reference.ambiguous ? "; tied alternatives retained" : ""}). This reference is not a verified key.`, "score-comparison-copy"));
  details.append(make("p", "Measured notes, exact field/shadow arithmetic, and inferred harmonic labels remain distinct. Candidate weights are not probabilities. Root motion and transitions follow leading inferred candidates; alternatives remain in the analysis export.", "score-comparison-copy"));
  const table = make("table", "", "score-distance-table"), head = make("thead"), heading = make("tr");
  for (const text of ["Feature block", "Content", "Evidence"]) { const cell = make("th", text); cell.scope = "col"; heading.append(cell); }
  head.append(heading); table.append(head); const body = make("tbody");
  for (const [label, content, evidence] of rows) { const row = make("tr"), title = make("th", label); title.scope = "row";
    row.append(title, make("td", content), make("td", evidence, "score-evidence-cell")); body.append(row); }
  table.append(body); details.append(table);
  details.append(make("p", "Four blocks remain pending: voice leading, temporal architecture, recurrence, and the full Holographic fingerprint. Local center trajectories are also pending. The eight saved-score and catalog comparison distances retain their existing definitions.", "score-comparison-copy"));
  const controls = make("div", "", "score-comparison-controls");
  for (const [label, value, filename] of [
    ["Export harmonic analysis JSON", hir, "Harmonic_Savant_Analysis.json"],
    ["Export expanded fingerprint JSON", fingerprint, "Harmonic_Savant_Expanded_Fingerprint.json"]
  ]) { const button = make("button", label, "fingerprint-save"); button.type = "button"; button.onclick = () => download(value, filename); controls.append(button); }
  details.append(controls, make("p", "The analysis export includes the original note events and source provenance. Saving a score in this browser keeps the existing compact comparison descriptor.", "score-comparison-copy"));
  return details;
}
