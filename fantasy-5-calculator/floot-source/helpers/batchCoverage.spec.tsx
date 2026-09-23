import { batchCoverage } from "./batchCoverage";

describe("batchCoverage",()=>{
  const tickets=[[5,12,19,27,38],[2,8,21,31,42],[1,11,22,32,41]];
  it("parses one ticket per line and ignores a sixth special ball",()=>{
    expect(batchCoverage.parse("1 2 3 4 5 18\n6, 7, 8, 9, 10 | 4","fantasy5")).toEqual([[1,2,3,4,5],[6,7,8,9,10]]);
  });
  it("rejects invalid lines",()=>expect(()=>batchCoverage.parse("1 2 3 4 5\n1 1 2 3 4","fantasy5")).toThrow());
  it("keeps uniform coverage bounded",()=>{
    const r=batchCoverage.analyze(tickets,"fantasy5","uniform");
    expect(r.coverage).toBeGreaterThan(0);expect(r.coverage).toBeLessThanOrEqual(100);
    expect(r.actualRadius).toBeGreaterThanOrEqual(r.referenceRadius);
  });
  it("builds a population-weighted reference with one-to-one matching",()=>{
    const r=batchCoverage.analyze(tickets,"fantasy5","population");
    expect(r.reference.length).toBe(3);expect(r.assignment.length).toBe(3);
    expect(r.totalWeight).toBe(850668);expect(r.rmsDistance).toBeGreaterThanOrEqual(0);
  });
  it("recovers the exact white-ball universe for all three games",()=>{
    expect(batchCoverage.analyze(tickets,"fantasy5","population").totalWeight).toBe(850668);
    expect(batchCoverage.analyze([[5,12,19,27,68],[2,18,31,49,69]],"powerball","population").totalWeight).toBe(11238513);
    expect(batchCoverage.analyze([[5,12,19,27,69],[2,18,31,49,70]],"megaMillions","population").totalWeight).toBe(12103014);
  });
});
