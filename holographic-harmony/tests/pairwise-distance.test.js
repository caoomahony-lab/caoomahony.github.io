import test from "node:test";
import assert from "node:assert/strict";
import { derivePairwiseDescriptor, comparePairwiseDescriptors, corpusSimilarityPercentile } from "../src/similarity/pairwise-distance.js";

function synthetic({transpose=0,variant=false}={}){
  const notes=(variant?[60,67,61,70,62,72,65,59]:[60,62,65,64,67,69,67,72]).map((m,i)=>({midi:m+transpose,onset:i*.5,duration:.4,confidence:.9}));
  const roots=(variant?[0,1,8,2,11]:[0,5,7,0,9]).map(x=>(x+transpose)%12);
  const regions=roots.map((rootPc,i)=>({rootPc,templateId:i%2?"minor":"major",onset:i*2,duration:2}));
  const chroma=Array(12).fill(0);for(const n of notes)chroma[((n.midi%12)+12)%12]++;
  return derivePairwiseDescriptor({analysis:{registeredNoteEvents:notes,overallChroma:chroma},harmony:{regions},fingerprintFeatures:{motion:.5,recurrence:.4,center:.7,collection:.8,diversity:.6,activity:.5}});
}
test("pairwise identity is transposition-invariant for a copied musical pattern",()=>{
  const a=synthetic(),b=synthetic({transpose:4}),cmp=comparePairwiseDescriptors(a,b);
  assert.ok(cmp.distance<0.08);
  assert.ok(cmp.similarityIndex.material>0.9);
  assert.ok(cmp.similarityIndex.structural>0.9);
});
test("same coarse fingerprint does not collapse different material into near identity",()=>{
  const a=synthetic(),b=synthetic({variant:true}),cmp=comparePairwiseDescriptors(a,b);
  assert.ok(cmp.distance>0.15);
  assert.ok(cmp.similarityIndex.material<0.9);
});
test("distance is symmetric",()=>{
  const a=synthetic(),b=synthetic({variant:true});
  assert.equal(comparePairwiseDescriptors(a,b).distance,comparePairwiseDescriptors(b,a).distance);
});
test("corpus percentile waits for enough baseline pairs",()=>{
  const a=synthetic(),b=synthetic({variant:true});
  assert.equal(corpusSimilarityPercentile(.2,[a,b]),null);
  const ds=[a,b,synthetic({transpose:1}),synthetic({transpose:2}),synthetic({transpose:3})];
  assert.ok(corpusSimilarityPercentile(.2,ds)?.pairCount>=10);
});
