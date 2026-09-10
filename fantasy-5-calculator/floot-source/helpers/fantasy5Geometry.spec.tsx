import { fantasy5Geometry } from "./fantasy5Geometry";

describe("fantasy5Geometry", () => {
  it("preserves the D=1 edge case", () => {
    const m = fantasy5Geometry.compute([1,2,3,4,5]);
    expect(m.D).toBe(1);
    expect(m.G).toBe(0);
    expect(m.C).toBe(1);
    expect(m.L).toBe(0);
  });

  it("keeps intrinsic deviations zero-sum", () => {
    const m = fantasy5Geometry.compute([3,10,18,29,42]);
    expect(Math.abs(m.d.reduce((a,b) => a+b, 0))).toBeLessThan(1e-12);
  });

  it("enumerates the canonical 38x38 structure", () => {
    const map = fantasy5Geometry.enumerate();
    expect(map.counts.flat().reduce((a,b) => a+b, 0)).toBe(850668);
    expect(map.occupiedCells).toBe(902);
    expect(map.minCell).toBe(2);
    expect(map.maxCell).toBe(3864);
  });
});
