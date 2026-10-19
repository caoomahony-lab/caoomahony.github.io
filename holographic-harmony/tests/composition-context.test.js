import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChordSequence } from '../src/input/chord-sequence.js';
import { buildCompositionContext, createPassage, comparePassages, searchPassages } from '../src/analysis/composition-context.js';
import { analyzeWorkbench, orderedContinuations } from '../src/continuation/workbench-service.js';
const song=(text,durations=[])=>({sourceId:'fixture:'+text,title:'Fixture',generation:1,evidenceClass:'measured-notes-inferred-chords',regions:parseChordSequence(text).chords.map((c,i)=>({index:i,onset:durations.slice(0,i).reduce((a,b)=>a+b,0)||i*2,end:(durations.slice(0,i).reduce((a,b)=>a+b,0)||i*2)+(durations[i]||2),pcs:c.pitchClasses,rootPc:c.rootPc,templateId:c.templateId,symbol:c.sourceSymbol}))});
test('compose-forward context cannot see changed future chords, durations or note events',()=>{
 const a=song('C | F | G | C | Dm'), b=song('C | F | G | F# | Bbm');
 const events=[{onsetSec:7,durationSec:1,endSec:8,midi:115,pitchClass:7}];
 const ca=buildCompositionContext(a,2),cb=buildCompositionContext(b,2,{events});
 assert.deepEqual(ca.features,cb.features); assert.deepEqual(ca.centerCandidates,cb.centerCandidates);
 for(const intention of ['continue','develop','contrast','return','modulate']){
  const options={progression:'C | F | G',ranking:{preset:'functional',limit:6},intention,modulationTonic:'D'};
  const sa=analyzeWorkbench({...options,compositionContext:ca}), sb=analyzeWorkbench({...options,compositionContext:cb});
  assert.deepEqual(orderedContinuations(sa).map(x=>[x.entry.presentation.symbol,x.rank?.combinedScore]),orderedContinuations(sb).map(x=>[x.entry.presentation.symbol,x.rank?.combinedScore]));
 }
});
test('analysis mode discloses future context and can produce different evidence',()=>{
 const a=song('C | G | F# | B'),ctx=buildCompositionContext(a,1,{mode:'analyze-reharmonize'});
 assert.equal(ctx.futureInformsAnalysis,true);assert.equal(ctx.contextEndIndex,3);assert.match(ctx.scope,/completed/i);
});
test('same final chord with different earlier root motifs changes contextual candidate scores',()=>{
 const a=buildCompositionContext(song('C | D | E | F# | G#'),4), b=buildCompositionContext(song('C | G | D | A | G#'),4);
 const options={progression:'C | G#',ranking:{preset:'functional',limit:6},intention:'develop'};
 const sa=analyzeWorkbench({...options,compositionContext:a}),sb=analyzeWorkbench({...options,compositionContext:b});
 assert.notDeepEqual(sa.composition.ranking.map(x=>[x.symbol,x.score]),sb.composition.ranking.map(x=>[x.symbol,x.score]));
});
test('all five intentions have operational definitions and distinct ranking behavior',()=>{
 const ctx=buildCompositionContext(song('C | F | Dm | G | C | Am | Dm | G'),7),seen=new Set();
 for(const intention of ['continue','develop','contrast','return','modulate']){const s=analyzeWorkbench({progression:'C | Am | Dm | G',compositionContext:ctx,intention,modulationTonic:'D',ranking:{preset:'functional',limit:6}});assert.ok(s.composition.definition.length>20);seen.add(JSON.stringify(s.composition.ranking.map(x=>[x.symbol,x.score])));}
 assert.equal(seen.size,5);
});
test('passage transposition and uniform tempo changes preserve declared sequence distances',()=>{
 const a=createPassage(song('C | Am | F | G'),0,3), b=createPassage(song('F# | D#m | B | C#'),0,3);
 b.regions=b.regions.map(r=>({...r,onset:r.onset*3,end:r.end*3}));
 const cmp=comparePassages(a,b);assert.equal(cmp.shiftBToA,6);assert.equal(cmp.pitchSetDistance,0);assert.equal(cmp.rootOrderDistance,0);assert.equal(cmp.relativeRhythmDistance,0);
 const reordered=createPassage(song('C | F | Am | G'),0,3);assert.ok(comparePassages(a,reordered).rootOrderDistance>0);
});
test('passage retrieval includes reproducible source offsets and refuses missing evidence',()=>{
 const query=createPassage(song('C | Am | F'),0,2),target=song('G | C | Am | F | Dm');
 const hits=searchPassages(query,[target]); assert.equal(hits[0].startIndex,1);assert.equal(hits[0].onset,2);assert.equal(hits[0].comparison.pitchSetDistance,0);
 const invalid=structuredClone(query);invalid.regions[1].pcs=[];assert.throws(()=>comparePassages(query,invalid),/evidence/i);
});
test('passage rhythm comparison detects inserted rests while retaining tempo-scale invariance',()=>{const a=createPassage(song('C | F | G'),0,2),b=structuredClone(a);b.regions[1].onset+=1;b.regions[1].end+=1;b.regions[2].onset+=1;b.regions[2].end+=1;assert.ok(comparePassages(a,b).relativeRhythmDistance>0);const c=structuredClone(b);c.regions=c.regions.map(r=>({...r,onset:r.onset*2,end:r.end*2}));assert.equal(comparePassages(b,c).relativeRhythmDistance,0);});
