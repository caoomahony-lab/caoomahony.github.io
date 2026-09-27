export const PAIRWISE_DISTANCE_VERSION = "pairwise-musical-distance-v1";
const clamp01=(x)=>Math.max(0,Math.min(1,Number(x)||0));
const mod12=(x)=>((Number(x)%12)+12)%12;
const norm=(a)=>{const v=Array.from({length:12},(_,i)=>Math.max(0,Number(a?.[i])||0));const s=v.reduce((x,y)=>x+y,0)||1;return v.map(x=>x/s);};
const cosine=(a,b)=>{let d=0,aa=0,bb=0;for(let i=0;i<a.length;i++){d+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?d/Math.sqrt(aa*bb):0;};
const hist=(items)=>{const out={};for(const k of items)out[k]=(out[k]||0)+1;return out;};
const histDistance=(a={},b={})=>{const keys=[...new Set([...Object.keys(a),...Object.keys(b)])];if(!keys.length)return null;const av=keys.map(k=>a[k]||0),bv=keys.map(k=>b[k]||0);return clamp01(1-cosine(av,bv));};
const weighted=(parts)=>{let s=0,w=0;for(const [v,weight] of parts){if(v==null||!Number.isFinite(v))continue;s+=v*weight;w+=weight;}return w?s/w:null;};
const family=(id)=>String(id||"unknown").replace(/major.*/i,"major").replace(/minor.*/i,"minor").replace(/dominant.*/i,"dominant").replace(/halfDiminished.*/i,"diminished");
const signedPcDelta=(a,b)=>{let d=mod12(b-a);if(d>6)d-=12;return d;};
const quantRatio=(x)=>String(Math.max(-8,Math.min(8,Math.round(Math.log2(Math.max(1e-6,x))*4))));
const topLine=(events=[])=>{
  const usable=events.filter(e=>Number.isFinite(Number(e.midi))&&Number.isFinite(Number(e.onset))).sort((a,b)=>a.onset-b.onset||b.midi-a.midi);
  const groups=[];for(const e of usable){const last=groups.at(-1);if(!last||Math.abs(e.onset-last.onset)>.09)groups.push({onset:Number(e.onset),notes:[e]});else last.notes.push(e);}
  return groups.map(g=>{const best=[...g.notes].sort((a,b)=>(Number(b.midi)-Number(a.midi))||(Number(b.confidence||0)-Number(a.confidence||0)))[0];return{onset:g.onset,midi:Number(best.midi)};});
};
const bestShiftCosine=(aRaw,bRaw)=>{const a=norm(aRaw),b=norm(bRaw);let best=0;for(let s=0;s<12;s++){const shifted=Array.from({length:12},(_,i)=>b[mod12(i-s)]);best=Math.max(best,cosine(a,shifted));}return best;};
const vectorDistance=(a=[],b=[])=>{const n=Math.max(a.length,b.length);if(!n)return null;let s=0;for(let i=0;i<n;i++)s+=Math.abs(Number(a[i]||0)-Number(b[i]||0));return clamp01(s/n);};

export function derivePairwiseDescriptor({analysis,harmony,fingerprintFeatures}={}){
  const line=topLine(analysis?.registeredNoteEvents||[]);
  const intervals=[];const iois=[];for(let i=1;i<line.length;i++){intervals.push(Math.max(-24,Math.min(24,Math.round(line[i].midi-line[i-1].midi))));iois.push(Math.max(.02,line[i].onset-line[i-1].onset));}
  const intervalHist=hist(intervals.map(String));
  const rhythmHist=hist(iois.slice(1).map((v,i)=>quantRatio(v/iois[i])));
  const motifs=[];for(let i=0;i+2<intervals.length;i++){const rr=i+1<iois.length?quantRatio(iois[i+1]/iois[i]):"0";motifs.push(`${intervals[i]},${intervals[i+1]},${intervals[i+2]}|${rr}`);}
  const regions=[...(harmony?.regions||[])].sort((a,b)=>Number(a.onset||0)-Number(b.onset||0));
  const htrans=[];for(let i=1;i<regions.length;i++){const a=regions[i-1],b=regions[i];if(a.rootPc==null||b.rootPc==null)continue;htrans.push(`${signedPcDelta(a.rootPc,b.rootPc)}:${family(a.templateId)}>${family(b.templateId)}`);}
  const durations=regions.map(r=>Math.max(.05,Number(r.duration)||Number(r.end)-Number(r.onset)||.05));const med=durations.length?[...durations].sort((a,b)=>a-b)[Math.floor(durations.length/2)]:1;
  const durationHist=hist(durations.map(v=>quantRatio(v/med)));
  const firstRoot=regions.find(r=>r.rootPc!=null)?.rootPc??0;const tokens=regions.map(r=>`${r.rootPc==null?"?":mod12(r.rootPc-firstRoot)}:${family(r.templateId)}`);
  const recurrence=[];for(let lag=1;lag<=8;lag++){let n=0,m=0;for(let i=lag;i<tokens.length;i++){n++;if(tokens[i]===tokens[i-lag])m++;}recurrence.push(n?m/n:0);}
  const profile=["motion","recurrence","center","collection","diversity","activity"].map(k=>clamp01(fingerprintFeatures?.[k]));
  return Object.freeze({
    version:PAIRWISE_DISTANCE_VERSION,evidenceClass:"inferred-from-audio",
    counts:Object.freeze({registeredNotes:line.length,regions:regions.length,motifs:motifs.length}),
    material:Object.freeze({intervalHist,motifHist:hist(motifs),rhythmHist}),
    structure:Object.freeze({harmonicTransitionHist:hist(htrans),durationHist,recurrence:Object.freeze(recurrence)}),
    style:Object.freeze({chroma:Object.freeze(norm(analysis?.overallChroma)),profile:Object.freeze(profile)})
  });
}

export function comparePairwiseDescriptors(a,b){
  const interval=histDistance(a?.material?.intervalHist,b?.material?.intervalHist);
  const motif=histDistance(a?.material?.motifHist,b?.material?.motifHist);
  const rhythm=histDistance(a?.material?.rhythmHist,b?.material?.rhythmHist);
  const harmonic=histDistance(a?.structure?.harmonicTransitionHist,b?.structure?.harmonicTransitionHist);
  const duration=histDistance(a?.structure?.durationHist,b?.structure?.durationHist);
  const recurrence=vectorDistance(a?.structure?.recurrence,b?.structure?.recurrence);
  const tonal=a?.style?.chroma?.length&&b?.style?.chroma?.length?clamp01(1-bestShiftCosine(a.style.chroma,b.style.chroma)):null;
  const profile=(a?.style?.profile?.length&&b?.style?.profile?.length)?Math.sqrt(a.style.profile.reduce((s,v,i)=>s+(v-(b.style.profile[i]||0))**2,0)/a.style.profile.length):null;
  const material=weighted([[motif,.45],[interval,.30],[rhythm,.25]]);
  const structural=weighted([[harmonic,.50],[recurrence,.30],[duration,.20]]);
  const stylistic=weighted([[tonal,.50],[profile,.50]]);
  const overall=weighted([[material,.45],[structural,.35],[stylistic,.20]]);
  return Object.freeze({
    version:PAIRWISE_DISTANCE_VERSION,distance:overall,
    families:Object.freeze({material,structural,stylistic}),
    components:Object.freeze({motif,interval,rhythm,harmonic,recurrence,duration,tonal,profile}),
    similarityIndex:Object.freeze({
      material:material==null?null:clamp01(1-material),
      structural:structural==null?null:clamp01(1-structural),
      stylistic:stylistic==null?null:clamp01(1-stylistic)
    })
  });
}

export function corpusSimilarityPercentile(distance,descriptors,{minimumPairs=10}={}){
  if(!Number.isFinite(distance))return null;
  const valid=(descriptors||[]).filter(Boolean),baseline=[];
  for(let i=0;i<valid.length;i++)for(let j=i+1;j<valid.length;j++){const d=comparePairwiseDescriptors(valid[i],valid[j]).distance;if(Number.isFinite(d))baseline.push(d);}
  if(baseline.length<minimumPairs)return null;
  let greater=0,equal=0;for(const d of baseline){if(d>distance+1e-12)greater++;else if(Math.abs(d-distance)<=1e-12)equal++;}
  return Object.freeze({percentile:100*(greater+.5*equal)/baseline.length,pairCount:baseline.length});
}
