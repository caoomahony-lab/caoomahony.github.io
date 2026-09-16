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
    this.svg = svgEl("svg", { viewBox: "0 0 600 520", role: "img", "aria-label": "Twelve pitch-class field" });
    this.svg.classList.add("pitch-circle-svg");

    const ring = svgEl("circle", { cx: 300, cy: 250, r: 190, class: "field-ring" });
    this.svg.appendChild(ring);

    for (let pc = 0; pc < 12; pc += 1) {
      const angle = (-90 + pc * 30) * Math.PI / 180;
      const x = 300 + 190 * Math.cos(angle);
      const y = 250 + 190 * Math.sin(angle);
      const group = svgEl("g", { transform: `translate(${x},${y})`, class: "pitch-node" });
      const halo = svgEl("circle", { r: 31, class: "pitch-halo" });
      const circle = svgEl("circle", { r: 24, class: "pitch-disc" });
      const text = svgEl("text", { x: 0, y: 5, "text-anchor": "middle", class: "pitch-label" });
      text.textContent = pitchClassName(pc);
      group.append(halo, circle, text);
      this.svg.appendChild(group);
      this.nodes.push({ group, halo, circle, text });
    }

    this.centerTitle = svgEl("text", { x: 300, y: 232, "text-anchor": "middle", class: "center-title" });
    this.centerTitle.textContent = "HOLOGRAPHIC FIELD";
    this.centerPrimary = svgEl("text", { x: 300, y: 263, "text-anchor": "middle", class: "center-primary" });
    this.centerPrimary.textContent = "—";
    this.centerSecondary = svgEl("text", { x: 300, y: 291, "text-anchor": "middle", class: "center-secondary" });
    this.centerSecondary.textContent = "ACTIVE ↔ SHADOW";
    this.svg.append(this.centerTitle, this.centerPrimary, this.centerSecondary);
    container.appendChild(this.svg);
  }

  update({ activeField, activity, events, timeSeconds, fieldLabel, crystallization }) {
    const active = new Set(activeField);
    for (let pc = 0; pc < 12; pc += 1) {
      const node = this.nodes[pc];
      const a = activity.normalized[pc] || 0;
      const flash = !active.has(pc) ? recentFlashStrength(events, timeSeconds, pc) : 0;
      const isActive = active.has(pc);
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
    this.centerPrimary.textContent = fieldLabel || "—";
    if (crystallization && crystallization.score >= 0.58) {
      this.centerSecondary.textContent = `CRYSTALLIZATION CANDIDATE ${(crystallization.score * 100).toFixed(0)}%`;
    } else {
      this.centerSecondary.textContent = "ACTIVE ↔ SHADOW";
    }
  }
}
