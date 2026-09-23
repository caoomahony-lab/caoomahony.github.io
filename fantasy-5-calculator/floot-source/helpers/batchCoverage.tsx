import { GAME_CONFIGS, LotteryGame, stateSpaceGeometry } from "./stateSpaceGeometry";

type Point = { d:number; g:number };
type WeightedPoint = Point & { weight:number };
export type CoverageMode = "uniform" | "population";

const cache = new Map<LotteryGame, { points:WeightedPoint[]; gMax:number; totalWeight:number; peak:WeightedPoint }>();

function theoreticalSpace(game:LotteryGame) {
  const cached=cache.get(game);
  if(cached) return cached;
  const max=GAME_CONFIGS[game].max, dMax=(max-1)/4;
  const raw:Array<{d:number;g:number;weight:number}>=[];
  let gMax=0;
  for(let R=4;R<=max-1;R++) {
    const D=R/4, counts=new Map<string,{g:number;count:number}>();
    for(let g1=1;g1<=R-3;g1++) for(let g2=1;g2<=R-g1-2;g2++) for(let g3=1;g3<=R-g1-g2-1;g3++) {
      const g4=R-g1-g2-g3;
      const variance=((g1-D)**2+(g2-D)**2+(g3-D)**2+(g4-D)**2)/4;
      const G=Math.sqrt(variance)/D, key=G.toFixed(12), old=counts.get(key);
      counts.set(key,{g:G,count:(old?.count||0)+1});
      if(G>gMax) gMax=G;
    }
    for(const {g,count} of counts.values()) raw.push({d:D,g,weight:count*(max-R)});
  }
  const points=raw.map(p=>({d:(p.d-1)/(dMax-1),g:p.g/gMax,weight:p.weight}));
  const totalWeight=points.reduce((s,p)=>s+p.weight,0);
  const peak=points.reduce((best,p)=>p.weight>best.weight?p:best,points[0]);
  const result={points,gMax,totalWeight,peak};
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
  const indices=[start], nearest=space.map(p=>distance(p,space[start]));
  while(indices.length<count) {
    let next=0;
    for(let i=1;i<nearest.length;i++) if(nearest[i]>nearest[next]) next=i;
    indices.push(next);
    for(let i=0;i<space.length;i++) nearest[i]=Math.min(nearest[i],distance(space[i],space[next]));
  }
  return {points:indices.map(i=>space[i]),radius:Math.max(...nearest)};
}

function bestFoundReference(space:Point[],count:number,actual:Point[]) {
  const centroid=space.reduce((s,p)=>({d:s.d+p.d,g:s.g+p.g}),{d:0,g:0});
  centroid.d/=space.length; centroid.g/=space.length;
  const nearestIndex=(target:Point)=>{
    let best=0,bestDistance=Infinity;
    space.forEach((p,i)=>{const next=distance(p,target);if(next<bestDistance){best=i;bestDistance=next;}});
    return best;
  };
  const starts=new Set<number>([
    nearestIndex(centroid),nearestIndex({d:0,g:0}),nearestIndex({d:0,g:1}),
    nearestIndex({d:1,g:0}),nearestIndex({d:1,g:1}),nearestIndex({d:.5,g:0}),nearestIndex({d:.5,g:1}),
  ]);
  let best:{points:Point[];radius:number}|null=null;
  for(const start of starts) {
    const candidate=farthestFirst(space,start,count);
    if(!best||candidate.radius<best.radius) best=candidate;
  }
  const actualRadius=radius(space,actual);
  return !best||actualRadius<best.radius?{points:actual,radius:actualRadius}:best;
}

function populationReference(space:WeightedPoint[],count:number,peak:WeightedPoint):Point[] {
  const centers:Point[]=[{d:peak.d,g:peak.g}], nearest2=space.map(p=>distance(p,peak)**2);
  while(centers.length<count) {
    let next=0,score=-1;
    for(let i=0;i<space.length;i++) {
      const s=space[i].weight*nearest2[i];
      if(s>score){score=s;next=i;}
    }
    centers.push({d:space[next].d,g:space[next].g});
    for(let i=0;i<space.length;i++) nearest2[i]=Math.min(nearest2[i],distance(space[i],space[next])**2);
  }
  for(let round=0;round<14;round++) {
    const sums=centers.map(()=>({d:0,g:0,w:0}));
    for(const point of space) {
      let best=0,bestD=distance(point,centers[0]);
      for(let j=1;j<centers.length;j++){const d=distance(point,centers[j]);if(d<bestD){best=j;bestD=d;}}
      sums[best].d+=point.d*point.weight;sums[best].g+=point.g*point.weight;sums[best].w+=point.weight;
    }
    let movement=0;
    for(let j=0;j<centers.length;j++) if(sums[j].w) {
      const next={d:sums[j].d/sums[j].w,g:sums[j].g/sums[j].w};
      movement+=distance(centers[j],next);centers[j]=next;
    }
    if(movement<1e-7) break;
  }
  return centers;
}

function optimalAssignment(reference:Point[],actual:Point[]) {
  const n=reference.length,u=Array(n+1).fill(0),v=Array(n+1).fill(0),p=Array(n+1).fill(0),way=Array(n+1).fill(0);
  for(let i=1;i<=n;i++) {
    p[0]=i;let j0=0;const minv=Array(n+1).fill(Infinity),used=Array(n+1).fill(false);
    do {
      used[j0]=true;const i0=p[j0];let delta=Infinity,j1=0;
      for(let j=1;j<=n;j++) if(!used[j]) {
        const cur=distance(reference[i0-1],actual[j-1])-u[i0]-v[j];
        if(cur<minv[j]){minv[j]=cur;way[j]=j0;}
        if(minv[j]<delta){delta=minv[j];j1=j;}
      }
      for(let j=0;j<=n;j++) if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else minv[j]-=delta;
      j0=j1;
    } while(p[j0]!==0);
    do {const j1=way[j0];p[j0]=p[j1];j0=j1;} while(j0!==0);
  }
  const pairs:Array<[number,number]>=[];for(let j=1;j<=n;j++) pairs.push([p[j]-1,j-1]);
  return pairs;
}

export const batchCoverage = {
  parse(text:string,game:LotteryGame):number[][] {
    const max=GAME_CONFIGS[game].max, lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    if(lines.length<2) throw new Error("Enter at least two tickets, one per line.");
    return lines.map((line,index)=>{
      const values=(line.match(/\d+/g)||[]).map(Number).slice(0,5);
      if(values.length!==5||values.some(v=>!Number.isInteger(v)||v<1||v>max)||new Set(values).size!==5)
        throw new Error(`Line ${index+1}: enter five distinct numbers from 1 to ${max}.`);
      return values.sort((a,b)=>a-b);
    });
  },
  analyze(tickets:number[][],game:LotteryGame,mode:CoverageMode="uniform") {
    if(tickets.length<2) throw new Error("Enter at least two tickets.");
    const {points:space,gMax,totalWeight,peak}=theoreticalSpace(game);
    const max=GAME_CONFIGS[game].max,dMax=(max-1)/4;
    const actual=tickets.map(ticket=>{const m=stateSpaceGeometry.compute(ticket,game);return {d:(m.D-1)/(dMax-1),g:m.G/gMax};});
    if(mode==="population") {
      const reference=populationReference(space,tickets.length,peak),assignment=optimalAssignment(reference,actual);
      const distances=assignment.map(([r,a])=>distance(reference[r],actual[a]));
      const totalDistance=distances.reduce((s,d)=>s+d,0),rmsDistance=Math.sqrt(distances.reduce((s,d)=>s+d*d,0)/distances.length);
      return {mode,count:tickets.length,coverage:100*Math.max(0,1-rmsDistance/Math.SQRT2),actualRadius:radius(space,actual),referenceRadius:0,
        excessRadius:0,totalDistance,rmsDistance,assignment,actual,reference,space,peak,totalWeight,dMax,gMax};
    }
    const actualRadius=radius(space,actual),reference=bestFoundReference(space,tickets.length,actual);
    return {mode,count:tickets.length,coverage:actualRadius===0?100:Math.min(100,100*reference.radius/actualRadius),actualRadius,
      referenceRadius:reference.radius,excessRadius:Math.max(0,actualRadius-reference.radius),totalDistance:0,rmsDistance:0,
      assignment:[] as Array<[number,number]>,actual,reference:reference.points,space,peak,totalWeight,dMax,gMax};
  }
};
