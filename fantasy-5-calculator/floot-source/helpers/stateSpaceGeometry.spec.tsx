import { fantasy5Geometry } from "./fantasy5Geometry";
import { stateSpaceGeometry } from "./stateSpaceGeometry";

describe("stateSpaceGeometry", () => {
  it("matches the canonical Powerball example", () => {
    const metrics = stateSpaceGeometry.compute([8, 56, 61, 62, 63], "powerball");
    expect(metrics.R).toBe(55);
    expect(metrics.D).toBe(13.75);
    expect(metrics.T).toBe(7);
    expect(metrics.S).toBeCloseTo(7 / 13, 10);
    expect(metrics.shapeCount).toBe(24804);
    expect(metrics.translations).toBe(14);
    expect(metrics.statesAtR).toBe(347256);
    expect(metrics.G).toBeCloseTo(1.4430, 4);
    expect(metrics.H).toBeCloseTo(-1.31818, 5);
    expect(metrics.qH).toBeCloseTo(-0.5895, 4);
    expect(metrics.qK).toBeCloseTo(0.3909, 4);
    expect(metrics.qT).toBeCloseTo(0.1423, 4);
  });

  it("uses each game's white-ball range", () => {
    expect(() => stateSpaceGeometry.compute([1, 2, 3, 4, 70], "megaMillions")).not.toThrow();
    expect(() => stateSpaceGeometry.compute([1, 2, 3, 4, 70], "powerball")).toThrow();
  });

  it("agrees with the certified Fantasy 5 geometry", () => {
    const ticket = [5, 12, 19, 27, 38];
    const general = stateSpaceGeometry.compute(ticket, "fantasy5");
    const fantasy = fantasy5Geometry.compute(ticket);
    for (const key of ["D", "G", "H", "C", "L", "S", "qH", "qK", "qT"] as const) {
      expect(general[key] as number).toBeCloseTo(fantasy[key] as number, 12);
    }
  });

  it("enumerates exactly one lattice point per positive gap composition", () => {
    const metrics = stateSpaceGeometry.compute([1, 3, 6, 10, 15], "fantasy5");
    expect(stateSpaceGeometry.lattice(metrics.R).length).toBe(metrics.shapeCount);
  });

  it("keeps normalized intrinsic deviations zero-sum", () => {
    const metrics = stateSpaceGeometry.compute([12, 24, 38, 51, 67], "megaMillions");
    expect(Math.abs(metrics.d.reduce((sum, value) => sum + value, 0))).toBeLessThan(1e-12);
  });
});

