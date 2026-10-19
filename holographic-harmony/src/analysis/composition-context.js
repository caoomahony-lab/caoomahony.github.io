import { inferCenterCandidates } from "../inference/centers.js";
import { mod12 } from "../theory/pitch.js";

export const COMPOSITION_CONTEXT_VERSION = "composition-context-v1-experimental";
export const PASSAGE_VERSION = "composition-passage-v1";
export const COMPOSITION_LIMITS = Object.freeze({ contextRegions: 2048, queryRegions: 128, sourceEvents: 20000, searchCells: 3000000 });
const validPc = pc => Number.isInteger(pc) && pc >= 0 && pc < 12;
const mean = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
const normalize = xs => { const sum=xs.reduce((a,b)=>a+b,0); return sum ? xs.map(x=>x/sum) : xs.map(()=>0); };
const setDistance = (a,b) => { const left=new Set(a),right=new Set(b); return 1-[...left].filter(x=>right.has(x)).length/new Set([...left,...right]).size; };
function validateRegions(regions, limit = COMPOSITION_LIMITS.contextRegions) {
  if (!Array.isArray(regions) || !regions.length || regions.length > limit) throw new RangeError(`Expected 1–${limit} sequence-bearing regions`);
  if (regions.some((r,i)=>!r || !Number.isFinite(r.onset) || !Number.isFinite(r.end) || r.onset<0 || r.end<=r.onset || (i && r.onset<regions[i-1].end-1e-9) || !Array.isArray(r.pcs) || !r.pcs.length || r.pcs.some(pc=>!validPc(pc)))) throw new TypeError("Complete ordered pitch-set and timing evidence required");
}
export function createPassage(song, startIndex, endIndex) {
  if (!song || typeof song.sourceId!=="string" || !Number.isInteger(startIndex) || !Number.isInteger(endIndex) || startIndex<0 || endIndex<startIndex || endIndex>=song.regions.length) throw new RangeError("Choose valid passage endpoints");
  const selected=song.regions.slice(startIndex,endIndex+1); validateRegions(selected,COMPOSITION_LIMITS.queryRegions);
  const offset=song.version===PASSAGE_VERSION?song.startIndex:0;
  return { version:PASSAGE_VERSION, sourceId:song.sourceId, title:song.title, evidenceClass:song.evidenceClass,
    startIndex:startIndex+offset,endIndex:endIndex+offset,onset:selected[0].onset,end:selected.at(-1).end,
    regions:selected.map(r=>({onset:r.onset,end:r.end,pcs:[...r.pcs],rootPc:r.rootPc??null,templateId:r.templateId??null,symbol:r.symbol??null})),
    provenance:{songProgressionVersion:song.version??null,selectionPolicy:"inclusive region endpoints; half-open sounding intervals",engineVersion:COMPOSITION_CONTEXT_VERSION} };
}
export function buildCompositionContext(song, selectedIndex, { mode="compose-forward", startIndex=selectedIndex, events=[] }={}) {
  if (!["compose-forward","analyze-reharmonize"].includes(mode)) throw new TypeError("Unknown composition context mode");
  if (!Number.isInteger(selectedIndex) || !song?.regions?.[selectedIndex] || !Number.isInteger(startIndex) || startIndex<0 || startIndex>selectedIndex) throw new RangeError("Select a valid composition interval");
  const contextEndIndex=mode==="compose-forward" ? selectedIndex : song.regions.length-1;
  const regions=song.regions.slice(0,contextEndIndex+1); validateRegions(regions);
  if (!Array.isArray(events) || events.length>COMPOSITION_LIMITS.sourceEvents) throw new RangeError("Source event budget exceeded");
  const cutoff=regions.at(-1).end, prefix=regions.slice(0,selectedIndex+1), current=prefix.at(-1);
  // Whole-score HIR centers/fields are deliberately not used in forward mode.
  const pitchMass=Array(12).fill(0), durations=regions.map(r=>r.end-r.onset);
  for(const r of regions)for(const pc of new Set(r.pcs))pitchMass[pc]+=(r.end-r.onset)/new Set(r.pcs).size;
  const centerCandidates=inferCenterCandidates(pitchMass,{limit:4,scaleLimitPerCenter:3}).map(c=>({centerPc:c.centerPc,support:c.support,relativeWeight:c.relativeWeight}));
  const roots=prefix.map(r=>r.rootPc), intervals=[];
  for(let i=1;i<roots.length;i++)intervals.push(validPc(roots[i])&&validPc(roots[i-1])?mod12(roots[i]-roots[i-1]):null);
  const intervalCounts=Array(12).fill(0), motifNextCounts=Array(12).fill(0), lastInterval=intervals.at(-1);
  for(const step of intervals)if(step!==null)intervalCounts[step]++;
  const motifMatches=[];
  for(let i=0;i<intervals.length-1;i++)if(lastInterval!==null&&intervals[i]===lastInterval&&intervals[i+1]!==null){motifNextCounts[intervals[i+1]]++;motifMatches.push({fromRegion:i,toRegion:i+2,nextInterval:intervals[i+1]});}
  const measured=song.evidenceClass==="measured-notes-inferred-chords";
  const clipped=measured?events.filter(e=>Number.isFinite(e.onsetSec)&&Number.isFinite(e.endSec)&&Number.isInteger(e.midi)&&e.onsetSec<cutoff&&e.endSec>0):[];
  const selectedTime=(current.onset+current.end)/2;
  const currentNotes=clipped.filter(e=>e.onsetSec<=selectedTime&&e.endSec>selectedTime).map(e=>e.midi);
  const attacks=clipped.filter(e=>!e.tieStop&&e.onsetSec>=0).sort((a,b)=>a.onsetSec-b.onsetSec||b.midi-a.midi), topAttack=[];
  for(const event of attacks)if(!topAttack.length||event.onsetSec!==topAttack.at(-1).onsetSec)topAttack.push({onsetSec:event.onsetSec,midi:event.midi});
  const topIntervals=topAttack.slice(1).map((e,i)=>e.midi-topAttack[i].midi);
  const features={pitchDistribution:normalize(pitchMass),rootMotionDistribution:normalize(intervalCounts),motifNextDistribution:normalize(motifNextCounts),
    motifMatches,openingPitchClasses:[...prefix[0].pcs],openingRoot:prefix[0].rootPc??null,currentRoot:current.rootPc??null,currentPitchClasses:[...current.pcs],
    selectedDuration:current.end-current.onset,relativeHold:(current.end-current.onset)/(mean(durations)||1),
    durationRatios:durations.map(x=>x/(mean(durations)||1)),recentPitchClasses:[...new Set(prefix.slice(-4).flatMap(r=>r.pcs))],
    registeredRange:clipped.length?[Math.min(...clipped.map(e=>e.midi)),Math.max(...clipped.map(e=>e.midi))]:null,
    selectedVoicing:currentNotes.length?[...new Set(currentNotes)].sort((a,b)=>a-b):null,
    topAttackIntervals:topIntervals.slice(-32),bassMidi:currentNotes.length?Math.min(...currentNotes):null,
    textureCardinality:currentNotes.length?new Set(currentNotes).size:null};
  return {version:COMPOSITION_CONTEXT_VERSION,sourceId:song.sourceId,mode,selectedIndex,startIndex,contextEndIndex,
    interval:{onset:song.regions[startIndex].onset,end:current.end},futureInformsAnalysis:mode==="analyze-reharmonize"&&contextEndIndex>selectedIndex,
    scope:mode==="compose-forward"?"Only source evidence through the selected point; no future regions or whole-score normalization.":"Completed composition may inform pitch/center/rhythm summaries; hypothetical continuation remains anchored at the selected point.",
    centerCandidates,features,evidence:{pitch:song.evidenceClass,pitchDistributionPolicy:"region duration split equally among its distinct pitch classes",rhythm:measured?"score-timed region durations":"inferred audio boundaries",register:clipped.length?"encoded registered notes; selected voicing sampled at interval midpoint":"unavailable",motif:"root-interval recurrence; upper attack proxy when present, not verified melody",form:"opening-return and duration proxies; no verified phrase/section labels"}};
}

export function comparePassages(a,b) {
  if(a?.version!==PASSAGE_VERSION||b?.version!==PASSAGE_VERSION)throw new TypeError("Unsupported passage evidence");
  validateRegions(a.regions,COMPOSITION_LIMITS.queryRegions);validateRegions(b.regions,COMPOSITION_LIMITS.queryRegions);
  if(a.regions.length!==b.regions.length)throw new RangeError("This passage method requires equal region counts; no interpolated alignment");
  const rhythm=regions=>regions.flatMap((r,i)=>[r.end-r.onset,...(i<regions.length-1?[Math.max(0,regions[i+1].onset-r.end)]:[])]);
  const n=a.regions.length,na=normalize(rhythm(a.regions)),nb=normalize(rhythm(b.regions));
  let best=null;
  for(let shift=0;shift<12;shift++){
    const pitchSetDistance=mean(a.regions.map((r,i)=>setDistance(r.pcs,b.regions[i].pcs.map(pc=>mod12(pc+shift)))));
    const rootsAvailable=a.regions.every(r=>validPc(r.rootPc))&&b.regions.every(r=>validPc(r.rootPc));
    const rootOrderDistance=rootsAvailable?mean(a.regions.map((r,i)=>r.rootPc===mod12(b.regions[i].rootPc+shift)&&r.templateId===b.regions[i].templateId?0:1)):null;
    const relativeRhythmDistance=na.reduce((sum,x,i)=>sum+Math.abs(x-nb[i]),0)/2;
    const record={shiftBToA:shift,pitchSetDistance,rootOrderDistance,relativeRhythmDistance,regionCount:n,
      alignment:a.regions.map((r,i)=>({indexA:a.startIndex+i,indexB:b.startIndex+i,onsetA:r.onset,endA:r.end,onsetB:b.regions[i].onset,endB:b.regions[i].end})),
      criterion:"mean ordered pitch-set Jaccard distance under one global transposition; equal region counts",rhythmDefinition:"total variation of ordered sounding-duration and intervening-rest shares",scope:"selected passage, no whole-piece similarity percentage",evidenceA:a.evidenceClass,evidenceB:b.evidenceClass};
    if(!best||pitchSetDistance<best.pitchSetDistance-1e-12||(Math.abs(pitchSetDistance-best.pitchSetDistance)<1e-12&&(rootOrderDistance??1)<(best.rootOrderDistance??1)))best=record;
  }
  return best;
}
export function searchPassages(query,sources,{limit=5,excludeOverlap=true}={}) {
  if(!Number.isInteger(limit)||limit<1||limit>20||!Array.isArray(sources)||sources.length>100)throw new RangeError("Passage search budget exceeded");
  validateRegions(query?.regions,COMPOSITION_LIMITS.queryRegions);
  const n=query.regions.length;let cells=0;const hits=[];
  for(const source of sources){
    if(!source||typeof source.sourceId!=="string")continue;
    validateRegions(source.regions);
    for(let start=0;start+n<=source.regions.length;start++){
      const offset=source.version===PASSAGE_VERSION?source.startIndex:0;
      if(excludeOverlap&&source.sourceId===query.sourceId&&start+offset<=query.endIndex&&start+n-1+offset>=query.startIndex)continue;
      cells+=n*12;if(cells>COMPOSITION_LIMITS.searchCells)throw new RangeError("Passage search cell budget exceeded; choose fewer sources or a shorter passage");
      const passage=createPassage(source,start,start+n-1),comparison=comparePassages(query,passage);
      hits.push({sourceId:source.sourceId,title:source.title,startIndex:passage.startIndex,endIndex:passage.endIndex,onset:passage.onset,end:passage.end,comparison});
    }
  }
  return hits.sort((a,b)=>a.comparison.pitchSetDistance-b.comparison.pitchSetDistance||(a.comparison.rootOrderDistance??1)-(b.comparison.rootOrderDistance??1)||a.comparison.relativeRhythmDistance-b.comparison.relativeRhythmDistance||a.startIndex-b.startIndex).slice(0,limit);
}
