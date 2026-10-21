import { pitchClassName } from "../theory/pitch.js";
import { recentFlashStrength } from "../theory/activity.js";

const NS = "http://www.w3.org/2000/svg";

function lerpColor(a, b, t) {
  const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const x = parse(a), y = parse(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * Math.max(0, Math.min(1, t))));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
  return el;
}

export class PitchCircle {
  constructor(container) {
    this.container = container;
    this.nodes = [];
    this.svg = svgEl("svg", { viewBox: "0 0 480 520", role: "group", "aria-label": "Twelve-note clock. Select a note to inspect its role." });
    this.svg.classList.add("pitch-circle-svg");

    const ring = svgEl("circle", { cx: 240, cy: 250, r: 184, class: "field-ring" });
    this.svg.appendChild(ring);

    for (let pc = 0; pc < 12; pc += 1) {
      const angle = (-90 + pc * 30) * Math.PI / 180;
      const x = 240 + 184 * Math.cos(angle);
      const y = 250 + 184 * Math.sin(angle);
      const group = svgEl("g", { transform: `translate(${x},${y})`, class: "pitch-node", role: "button", tabindex: "0", "data-pc": pc });
      const hit = svgEl("circle", { r: 40, class: "pitch-hit" });
      const sounding = svgEl("circle", { r: 30, class: "pitch-sounding" });
      const tonic = svgEl("circle", { r: 35, class: "pitch-tonic" });
      const badge = svgEl("text", { x: 0, y: 46, "text-anchor": "middle", class: "pitch-badge" });
      const title = svgEl("title");
      const halo = svgEl("circle", { r: 31, class: "pitch-halo" });
      const circle = svgEl("circle", { r: 24, class: "pitch-disc" });
      const text = svgEl("text", { x: 0, y: 5, "text-anchor": "middle", class: "pitch-label" });
      text.textContent = pitchClassName(pc);
      group.append(title, hit, halo, tonic, sounding, circle, text, badge);
      group.addEventListener("click", () => this.onSelect?.(pc));
      group.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); this.onSelect?.(pc); } });
      this.svg.appendChild(group);
      this.nodes.push({ group, halo, circle, text, sounding, tonic, badge, title });
    }

    this.centerTitle = svgEl("text", { x: 240, y: 232, "text-anchor": "middle", class: "center-title" });
    this.centerTitle.textContent = "HOLOGRAPHIC FIELD";
    this.centerPrimary = svgEl("text", { x: 240, y: 263, "text-anchor": "middle", class: "center-primary" });
    this.centerPrimary.textContent = "—";
    this.centerSecondary = svgEl("text", { x: 240, y: 291, "text-anchor": "middle", class: "center-secondary" });
    this.centerSecondary.textContent = "ACTIVE ↔ SHADOW";
    this.svg.append(this.centerTitle, this.centerPrimary, this.centerSecondary);
    container.appendChild(this.svg);
  }

  update({ activeField, activity, events, timeSeconds, fieldLabel, crystallization, clock = null }) {
    if (clock) return this.updateMemory(clock);
    this.svg.classList.remove?.("clock-memory-view");
    const active = new Set(activeField);
    for (let pc = 0; pc < 12; pc += 1) {
      const node = this.nodes[pc];
      node.group.classList.toggle("is-song-color", false);
      node.group.classList.toggle("is-tonic", false);
      node.group.classList.toggle("is-sounding", false);
      node.text.textContent = pitchClassName(pc); node.badge.textContent = "";
      node.group.setAttribute("aria-label", `${pitchClassName(pc)} · original field view`);
      const a = activity.normalized[pc] || 0;
      const flash = !active.has(pc) ? recentFlashStrength(events, timeSeconds, pc) : 0;
      const isActive = active.has(pc);
      node.group.setAttribute("data-kind", "legacy-field");
      node.group.setAttribute("data-entrances", "");
      node.group.classList.toggle("is-active", isActive);
      node.group.classList.toggle("is-shadow", !isActive);
      node.group.classList.toggle("is-flashing", flash > 0);
      node.circle.style.setProperty("--heat", a.toFixed(4));
      node.halo.style.setProperty("--flash", flash.toFixed(4));
      node.circle.style.fill = flash > 0
        ? lerpColor("#e9f4ff", "#ffffff", flash)
        : isActive
          ? lerpColor("#2b0a16", "#ff315d", a)
          : lerpColor("#07172b", "#2388ff", a);
      node.circle.setAttribute("r", String(23 + a * 5));
    }
    this.centerTitle.textContent = "LOCAL FIELD";
    this.centerPrimary.style.fontSize = "";
    this.centerPrimary.textContent = fieldLabel || "—";
    if (crystallization && crystallization.score >= 0.58) {
      this.centerSecondary.textContent = `CRYSTALLIZATION CANDIDATE ${(crystallization.score * 100).toFixed(0)}%`;
    } else {
      this.centerSecondary.textContent = "ACTIVE ↔ SHADOW";
    }
  }

  updateMemory(clock) {
    this.svg.classList.add("clock-memory-view");
    for (const note of clock.notes) {
      const node = this.nodes[note.pc], flashing = note.flash > 0;
      for (const [name, enabled] of [["is-active", note.inKey], ["is-shadow", !note.inKey],
        ["is-song-color", note.kind === "song-color"], ["is-flashing", flashing],
        ["is-tonic", note.tonic], ["is-sounding", note.sounding]]) node.group.classList.toggle(name, enabled);
      node.group.setAttribute("data-kind", note.kind);
      node.group.setAttribute("data-entrances", note.entrances);
      const role = note.inKey ? "key note" : note.kind === "song-color" ? "retained song color" : note.entrances ? "one-off or transient" : "not yet heard";
      const description = `${note.label} · ${role}${note.tonic ? " · tonic" : ""} · ${note.entrances} distinct entrances${note.sounding ? " · sounding now" : ""}`;
      node.group.setAttribute("aria-label", description); node.title.textContent = description;
      node.circle.style.fill = flashing ? "#f4f7fa" : note.inKey ? "#6b2035" : note.kind === "song-color" ? "#9b681f" : "#0c2138";
      node.circle.setAttribute("r", "24");
      node.halo.style.setProperty("--flash", note.flash.toFixed(3));
      node.text.textContent = note.label;
      node.badge.textContent = note.kind === "song-color" ? `×${note.entrances}` : note.tonic ? "TONIC" : "";
    }
    this.centerTitle.textContent = "SONG KEY";
    this.centerPrimary.textContent = clock.key.label;
    this.centerPrimary.style.fontSize = clock.key.label.length > 18 ? "20px" : "26px";
    this.centerSecondary.textContent = clock.keySince > 0 ? `MODULATION AT ${clock.keySince.toFixed(1)} s` : clock.key.basis;
  }

}
