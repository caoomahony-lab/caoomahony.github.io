import { GAME_CONFIGS, LotteryGame, stateSpaceGeometry } from "./stateSpaceGeometry";

type Point = { d:number; g:number };

const cache = new Map<LotteryGame, { points:Point[]; gMax:number }>();

function theoreticalSpace(game:LotteryGame) {
  const cached=cache.get(game);
  if(cached) return cached;
  const max=GAME_CONFIGS[game].max;
  const dMax=(max-1)/4;
  const raw:Array<{d:number;g:number}>=[];
  let gMax=0;
  for(let R=4;R<=max-1;R++) {
    const D=R/4;
    const seen=new Set<string>();
    for(let g1=1;g1<=R-3;g1++) for(let g2=1;g2<=R-g1-2;g2++) for(let g3=1;g3<=R-g1-g2-1;g3++) {
      const g4=R-g1-g2-g3;
      const variance=((g1-D)**2+(g2-D)**2+(g3-D)**2+(g4-D)**2)/4;
      const G=Math.sqrt(variance)/D;
      const key=G.toFixed(12);
      if(!seen.has(key)) {
        seen.add(key);
        raw.push({d:D,g:G});
        if(G>gMax) gMax=G;
      }
    }
  }
  const points=raw.map(p=>({d:(p.d-1)/(dMax-1),g:p.g/gMax}));
  const result={points,gMax};
  cache.set(game,result);
  return result;
}

const distance=(a:Point,b:Point)=>Math.hypot(a.d-b.d,a.g-b.g);

function radius(space:Point[],centers:Point[]) {
  let worst=0;
  for(const point of space) {
    let nearest=Infinity;
    for(const center of centers) nearest=Math.min(nearest,distance(point,center));
    worst=Math.max(worst,nearest);
  }
  return worst;
}

function farthestFirst(space:Point[],start:number,count:number) {
  const indices=[start];
  const nearest=space.map(p=>distance(p,space[start]));
  while(indices.length<count) {
    let next=0;
    for(let i=1;i<nearest.length;i++) if(nearest[i]>nearest[next]) next=i;
    indices.push(next);
    for(let i=0;i<space.length;i++) nearest[i]=Math.min(nearest[i],distance(space[i],space[next]));
  }
  const points=indices.map(i=>space[i]);
  return {points,radius:Math.max(...nearest)};
}

function bestFoundReference(space:Point[],count:number,actual:Point[]) {
  const centroid=space.reduce((s,p)=>({d:s.d+p.d,g:s.g+p.g}),{d:0,g:0});
  centroid.d/=space.length; centroid.g/=space.length;
  const nearestIndex=(target:Point)=>{
    let best=0,bestDistance=Infinity;
    space.forEach((p,i)=>{const next=distance(p,target); if(next<bestDistance){best=i;bestDistance=next;}});
    return best;
  };
  const starts=new Set<number>([
    nearestIndex(centroid),
    nearestIndex({d:0,g:0}), nearestIndex({d:0,g:1}),
    nearestIndex({d:1,g:0}), nearestIndex({d:1,g:1}),
    nearestIndex({d:.5,g:0}), nearestIndex({d:.5,g:1}),
  ]);
  let best:{points:Point[];radius:number}|null=null;
  for(const start of starts) {
    const candidate=farthestFirst(space,start,count);
    if(!best || candidate.radius<best.radius) best=candidate;
  }
  const actualRadius=radius(space,actual);
  if(!best || actualRadius<best.radius) return {points:actual,radius:actualRadius};
  return best;
}

export const batchCoverage = {
  parse(text:string,game:LotteryGame):number[][] {
    const max=GAME_CONFIGS[game].max;
    const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    if(lines.length<2) throw new Error("Enter at least two tickets, one per line.");
    return lines.map((line,index)=>{
      const values=(line.match(/\d+/g)||[]).map(Number);
      if(values.length!==5 || values.some(v=>!Number.isInteger(v)||v<1||v>max) || new Set(values).size!==5) {
        throw new Error(`Line ${index+1}: enter five distinct numbers from 1 to ${max}.`);
      }
      return values.sort((a,b)=>a-b);
    });
  },
  analyze(tickets:number[][],game:LotteryGame) {
    if(tickets.length<2) throw new Error("Enter at least two tickets.");
    const {points:space,gMax}=theoreticalSpace(game);
    const max=GAME_CONFIGS[game].max;
    const dMax=(max-1)/4;
    const actual=tickets.map(ticket=>{
      const metrics=stateSpaceGeometry.compute(ticket,game);
      return {d:(metrics.D-1)/(dMax-1),g:metrics.G/gMax};
    });
    const actualRadius=radius(space,actual);
    const reference=bestFoundReference(space,tickets.length,actual);
    const coverage=actualRadius===0?100:Math.min(100,100*reference.radius/actualRadius);
    return {
      count:tickets.length,
      coverage,
      actualRadius,
      referenceRadius:reference.radius,
      excessRadius:Math.max(0,actualRadius-reference.radius),
      actual,
      reference:reference.points,
      space,
    };
  }
};
