import { COMPOSITION_CONTEXT_VERSION } from "../analysis/composition-context.js";
import { mod12 } from "../theory/pitch.js";
import { parseSpelledPitchClass } from "../theory/functions.js";
export const COMPOSITION_INTENTIONS = Object.freeze({
  continue: { definition:"Continue the observed root motion and recent collection, with functional continuity; longer held moments favor return support.", weights:{functional:2,motion:2,collection:2,voiceLeading:1,rhythmicReturn:1} },
  develop: { definition:"Develop observed root-interval recurrences while retaining common tones and allowing some new material.", weights:{motif:4,commonTone:2,novelty:1,voiceLeading:1} },
  contrast: { definition:"Contrast the recent pitch collection and prior vocabulary; this is a harmonic contrast heuristic, not a verified section label.", weights:{contrast:4,novelty:2,voiceLeading:0.5} },
  return: { definition:"Return toward the opening pitch set/root, with functional and duration-supported arrival; does not require a tonic interpretation.", weights:{opening:4,openingRoot:2,rhythmicReturn:1,functional:0.5} },
  modulate: { definition:"Prepare or establish the explicitly chosen target major center through its dominant or tonic and collection membership; a candidate alone does not establish modulation.", weights:{target:5,voiceLeading:1,commonTone:1} }
});
const overlap=(a,b)=>{const s=new Set(a);return new Set(b).size?[...new Set(b)].filter(pc=>s.has(pc)).length/new Set(b).size:0;};
const available=(score,basis)=>({available:score!==null,score,basis,evidenceClass:"explicit-composition-heuristic"});
export function rankCompositionContinuations(session,context,{intention="continue",modulationTonic=""}={}) {
  if(context?.version!==COMPOSITION_CONTEXT_VERSION || !context.features || !COMPOSITION_INTENTIONS[intention])throw new TypeError("Compatible composition context and intention required");
  const spec=COMPOSITION_INTENTIONS[intention],f=context.features;
  const target=intention==="modulate"?parseSpelledPitchClass(modulationTonic).pitchClass:null;
  const targetField=target===null?null:[0,2,4,5,7,9,11].map(pc=>mod12(pc+target));
  const rankings=session.candidates.map(entry=>{
    const chord=entry.candidate,pcs=chord.pitchClasses,root=chord.rootPc,step=root==null||f.currentRoot==null?null:mod12(root-f.currentRoot);
    const motifExists=f.motifNextDistribution.some(x=>x>0),motionExists=f.rootMotionDistribution.some(x=>x>0);
    const novelty=entry.dimensions.novelty,voice=entry.dimensions.voiceLeading,func=entry.dimensions.functional;
    const opening=overlap(f.openingPitchClasses,pcs),sameOpeningRoot=root==null||f.openingRoot==null?null:Number(root===f.openingRoot);
    const dimensions={
      functional:available(func.available?func.score:null,"unchanged local functional engine"),
      voiceLeading:available(voice.available?voice.score:null,"bounded registered voicing search; unavailable without encoded/user-supplied voicing"),
      novelty:available(novelty.available?novelty.score:null,"unchanged local novelty engine"),
      motion:available(step===null||!motionExists?null:f.rootMotionDistribution[step],"frequency of this root step in observed history"),
      motif:available(step===null||!motionExists?null:(motifExists?f.motifNextDistribution:f.rootMotionDistribution)[step],motifExists?"next root interval after earlier occurrences of the latest root step":"root-motion distribution fallback; repeated motif not established"),
      collection:available(overlap(f.recentPitchClasses,pcs),"fraction of candidate pitch classes in recent four source regions"),
      commonTone:available(overlap(f.currentPitchClasses,pcs),"fraction of candidate pitch classes shared with selected chord"),
      contrast:available(1-overlap(f.recentPitchClasses,pcs),"fraction of candidate pitch classes outside recent four regions"),
      opening:available(opening,"pitch-class overlap with source opening"),
      openingRoot:available(sameOpeningRoot,"same inferred root as source opening"),
      rhythmicReturn:available((f.relativeHold>=1?opening:1-opening),`selected hold / context mean=${f.relativeHold.toFixed(3)}; duration-based arrival proxy`),
      target:available(target===null?null:0.5*overlap(targetField,pcs)+0.5*(root===target?1:root===mod12(target+7)?0.85:0),"target-major collection plus explicit target tonic/dominant root")
    };
    const usable=Object.entries(spec.weights).filter(([name,weight])=>weight>0&&dimensions[name].available),sum=usable.reduce((s,[,w])=>s+w,0);
    return {symbol:entry.presentation.symbol,key:chord.key??`${root}:${chord.templateId}`,candidate:chord,score:sum?usable.reduce((s,[k,w])=>s+dimensions[k].score*w,0)/sum:null,
      dimensions,weights:spec.weights,effectiveWeights:Object.fromEntries(usable.map(([k,w])=>[k,w/sum])),
      suggestedDurationSeconds:Math.max(0.2,Math.min(4,f.selectedDuration*(intention==="contrast"?0.5:intention==="return"?1.5:1))),
      generatedVoicing:voice.available?voice.bestVoicing:null};
  }).filter(x=>x.score!==null).sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol));
  return {version:COMPOSITION_CONTEXT_VERSION,intention,definition:spec.definition,weights:spec.weights,mode:context.mode,
    context,modulationTarget:target,ranking:rankings,evidenceClass:"experimental-explicit-heuristics",
    note:"Composition-aware hypotheses, not musical necessity or validated listener preference. Corpus and learned personal-style evidence remain unavailable."};
}
