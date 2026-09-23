import { batchCoverage } from "./batchCoverage";

describe("batchCoverage",()=>{
  it("parses one ticket per line",()=>{
    expect(batchCoverage.parse("1 2 3 4 5\n6, 7, 8, 9, 10","fantasy5")).toEqual([
      [1,2,3,4,5],[6,7,8,9,10]
    ]);
  });

  it("rejects invalid lines",()=>{
    expect(()=>batchCoverage.parse("1 2 3 4 5\n1 1 2 3 4","fantasy5")).toThrow();
  });

  it("returns a bounded coverage score and nonnegative excess",()=>{
    const result=batchCoverage.analyze([
      [5,12,19,27,38],
      [2,8,21,31,42],
      [1,11,22,32,41],
    ],"fantasy5");
    expect(result.coverage).toBeGreaterThan(0);
    expect(result.coverage).toBeLessThanOrEqual(100);
    expect(result.actualRadius).toBeGreaterThanOrEqual(result.referenceRadius);
    expect(result.excessRadius).toBeGreaterThanOrEqual(0);
  });
});
