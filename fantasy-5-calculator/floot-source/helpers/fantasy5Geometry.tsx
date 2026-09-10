export type TicketMetrics = {
  ticket: number[];
  gaps: number[];
  diffs: number[];
  R: number;
  D: number;
  G: number;
  H: number;
  C: number;
  L: number;
  S: number | null;
  p: number[];
  d: number[];
  qH: number;
  qK: number;
  qT: number;
  sd: number;
  variance: number;
  dIndex: number;
  gIndex: number;
};

export type GeometryMap = {
  counts: number[][];
  occupiedCells: number;
  minCell: number;
  maxCell: number;
  dCounts: number[];
  gCounts: number[];
};

export const fantasy5Geometry = {
  TOTAL: 850668,
  GMAX: 1.5630702409767916,
  compute(input: number[]): TicketMetrics {
    if (input.length !== 5 || input.some((v) => !Number.isInteger(v) || v < 1 || v > 42) || new Set(input).size !== 5) {
      throw new Error("Enter five distinct whole numbers from 1 to 42.");
    }
    const ticket = [...input].sort((a, b) => a - b);
    const gaps = [ticket[1] - ticket[0], ticket[2] - ticket[1], ticket[3] - ticket[2], ticket[4] - ticket[3]];
    const R = ticket[4] - ticket[0];
    const D = R / 4;
    const variance = gaps.reduce((s, g) => s + (g - D) ** 2, 0) / 4;
    const sd = Math.sqrt(variance);
    const G = sd / D;
    const H = (-1.5 * gaps[0] - 0.5 * gaps[1] + 0.5 * gaps[2] + 1.5 * gaps[3]) / R;
    const C = D === 1 ? 1 : gaps.reduce((s, g) => s + Math.max(0, (D / g - 1) / (D - 1)), 0) / 4;
    const diffs = [gaps[1] - gaps[0], gaps[2] - gaps[1], gaps[3] - gaps[2]];
    const nonzero = diffs.filter((v) => v !== 0);
    const signs = nonzero.map(Math.sign);
    let reversals = 0;
    for (let i = 1; i < signs.length; i++) if (signs[i] !== signs[i - 1]) reversals++;
    const A = Math.min(1, diffs.reduce((s, v) => s + Math.abs(v), 0) / R);
    const P = nonzero.length / 3;
    const L = (reversals / 2) * A * P;
    const S = R < 41 ? (ticket[0] - 1) / (41 - R) : null;
    const p = gaps.map((g) => g / R);
    const d = p.map((v) => v - 0.25);
    const root20 = Math.sqrt(20);
    const qH = d.reduce((s, v, i) => s + v * [-3 / root20, -1 / root20, 1 / root20, 3 / root20][i], 0);
    const qK = d.reduce((s, v, i) => s + v * [0.5, -0.5, -0.5, 0.5][i], 0);
    const qT = d.reduce((s, v, i) => s + v * [1 / root20, -3 / root20, 3 / root20, -1 / root20][i], 0);
    const dIndex = Math.round((D - 1) / 0.25) + 1;
    const gWidth = this.GMAX / 38;
    const gIndex = Math.min(38, Math.floor(G / gWidth) + 1);
    return { ticket, gaps, diffs, R, D, G, H, C, L, S, p, d, qH, qK, qT, sd, variance, dIndex, gIndex };
  },
  enumerate(): GeometryMap {
    const counts = Array.from({ length: 38 }, () => Array(38).fill(0));
    const dCounts = Array(38).fill(0);
    const gCounts = Array(38).fill(0);
    const gWidth = this.GMAX / 38;
    for (let a = 1; a <= 38; a++) {
      for (let b = a + 1; b <= 39; b++) {
        for (let c = b + 1; c <= 40; c++) {
          for (let d = c + 1; d <= 41; d++) {
            for (let e = d + 1; e <= 42; e++) {
              const g1 = b - a, g2 = c - b, g3 = d - c, g4 = e - d;
              const R = e - a;
              const D = R / 4;
              const variance = ((g1 - D) ** 2 + (g2 - D) ** 2 + (g3 - D) ** 2 + (g4 - D) ** 2) / 4;
              const G = Math.sqrt(variance) / D;
              const di = Math.round((D - 1) / 0.25);
              const gi = Math.min(37, Math.floor(G / gWidth));
              counts[di][gi]++;
              dCounts[di]++;
              gCounts[gi]++;
            }
          }
        }
      }
    }
    const values = counts.flat().filter((v) => v > 0);
    return {
      counts,
      occupiedCells: values.length,
      minCell: Math.min(...values),
      maxCell: Math.max(...values),
      dCounts,
      gCounts,
    };
  },
};
