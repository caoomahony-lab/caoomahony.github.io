import { pitchClassName } from "../theory/pitch.js";

export class HolographicTimeline {
  constructor(canvas, onSeek) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onSeek = onSeek;
    this.data = { duration: 1, time: 0, admissions: [] };
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(canvas);
    canvas.addEventListener("click", (event) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      this.onSeek?.(ratio * this.data.duration);
    });
  }

  update(data) {
    this.data = { ...this.data, ...data };
    this.draw();
  }

  draw() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const w = rect.width;
    const h = rect.height;
    const y = h * 0.55;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(170,190,220,.28)";
    ctx.beginPath();
    ctx.moveTo(12, y);
    ctx.lineTo(w - 12, y);
    ctx.stroke();

    const duration = Math.max(0.001, this.data.duration || 1);
    for (const admission of this.data.admissions || []) {
      const x = 12 + (w - 24) * (admission.firstOnset / duration);
      ctx.strokeStyle = admission.persistent ? "rgba(255,255,255,.85)" : "rgba(108,180,255,.75)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y - 19);
      ctx.lineTo(x, y + 19);
      ctx.stroke();
      ctx.fillStyle = "rgba(225,235,250,.86)";
      ctx.font = "11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(pitchClassName(admission.pc), x, y - 26);
    }

    const progressX = 12 + (w - 24) * Math.max(0, Math.min(1, (this.data.time || 0) / duration));
    ctx.strokeStyle = "rgba(255,255,255,.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(progressX, 10);
    ctx.lineTo(progressX, h - 10);
    ctx.stroke();
  }

  destroy() {
    this.resizeObserver.disconnect();
  }
}
