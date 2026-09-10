export type LotteryGame = "fantasy5" | "powerball" | "megaMillions";

export type GameConfig = { id: LotteryGame; label: string; short: string; max: number };
export const GAME_CONFIGS: Record<LotteryGame, GameConfig> = {
  fantasy5: { id:"fantasy5", label:"Fantasy 5 · 1–42", short:"Fantasy 5", max:42 },
  powerball: { id:"powerball", label:"Powerball white balls · 1–69", short:"Powerball white balls", max:69 },
  megaMillions: { id:"megaMillions", label:"Mega Millions white balls · 1–70", short:"Mega Millions white balls", max:70 },
};

export type StatePoint = {
  ticket:number[]; gaps:number[]; R:number; D:number; T:number; S:number|null;
  p:number[]; d:number[]; qH:number; qK:number; qT:number; G:number; H:number; C:number; L:number;
  shapeCount:number; translations:number; statesAtR:number; lambda:number;
};

const choose=(n:number,k:number)=>{
  if(k<0||n<k) return 0;
  let v=1;
  for(let i=1;i<=k;i++) v=v*(n-k+i)/i;
  return Math.round(v);
};

export const stateSpaceGeometry = {
  compute(input:number[], game:LotteryGame):StatePoint {
    const M=GAME_CONFIGS[game].max;
    if(input.length!==5 || input.some(v=>!Number.isInteger(v)||v<1||v>M) || new Set(input).size!==5) throw new Error(`Enter five distinct whole numbers from 1 to ${M}.`);
    const ticket=[...input].sort((a,b)=>a-b);
    const gaps=[ticket[1]-ticket[0],ticket[2]-ticket[1],ticket[3]-ticket[2],ticket[4]-ticket[3]];
    const R=ticket[4]-ticket[0], D=R/4, T=ticket[0]-1;
    const translations=M-R;
    const S=translations>1 ? T/(translations-1) : null;
    const mean=D, variance=gaps.reduce((s,g)=>s+(g-mean)**2,0)/4, G=Math.sqrt(variance)/D;
    const H=(-1.5*gaps[0]-.5*gaps[1]+.5*gaps[2]+1.5*gaps[3])/R;
    const C=D===1?1:gaps.reduce((s,g)=>s+Math.max(0,(D/g-1)/(D-1)),0)/4;
    const diffs=[gaps[1]-gaps[0],gaps[2]-gaps[1],gaps[3]-gaps[2]], nz=diffs.filter(v=>v!==0), signs=nz.map(Math.sign);
    let reversals=0; for(let i=1;i<signs.length;i++) if(signs[i]!==signs[i-1]) reversals++;
    const A=Math.min(1,diffs.reduce((s,v)=>s+Math.abs(v),0)/R), P=nz.length/3, L=(reversals/2)*A*P;
    const p=gaps.map(g=>g/R), d=p.map(v=>v-.25), root20=Math.sqrt(20);
    const qH=d.reduce((s,v,i)=>s+v*[-3/root20,-1/root20,1/root20,3/root20][i],0);
    const qK=d.reduce((s,v,i)=>s+v*[.5,-.5,-.5,.5][i],0);
    const qT=d.reduce((s,v,i)=>s+v*[1/root20,-3/root20,3/root20,-1/root20][i],0);
    const shapeCount=choose(R-1,3);
    return { ticket,gaps,R,D,T,S,p,d,qH,qK,qT,G,H,C,L,shapeCount,translations,statesAtR:shapeCount*translations,lambda:1-1/D };
  },
  random(game:LotteryGame):number[] {
    const M=GAME_CONFIGS[game].max, set=new Set<number>();
    while(set.size<5) set.add(1+Math.floor(Math.random()*M));
    return [...set].sort((a,b)=>a-b);
  },
  lattice(R:number):Array<[number,number,number]> {
    const pts:Array<[number,number,number]>=[];
    const root20=Math.sqrt(20);
    for(let g1=1;g1<=R-3;g1++) for(let g2=1;g2<=R-g1-2;g2++) for(let g3=1;g3<=R-g1-g2-1;g3++) {
      const g4=R-g1-g2-g3;
      const d=[g1/R-.25,g2/R-.25,g3/R-.25,g4/R-.25];
      const qH=d.reduce((s,v,i)=>s+v*[-3/root20,-1/root20,1/root20,3/root20][i],0);
      const qK=d.reduce((s,v,i)=>s+v*[.5,-.5,-.5,.5][i],0);
      const qT=d.reduce((s,v,i)=>s+v*[1/root20,-3/root20,3/root20,-1/root20][i],0);
      pts.push([qH,qK,qT]);
    }
    return pts;
  }
};
