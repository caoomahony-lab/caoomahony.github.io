import { derivePairwiseDescriptor, comparePairwiseDescriptors, corpusSimilarityPercentile } from "../similarity/pairwise-distance.js";
import { EVIDENCE_AWARE_VERSION, deriveEvidenceAwareDescriptor, compareEvidenceAwareDescriptors, evidenceAwareCorpusPercentile } from "../similarity/evidence-aware-distance.js";

export const FINGERPRINT_EXPLORER_VERSION = "fingerprint-explorer-beta-v4";
export const FINGERPRINT_DIMENSIONS = Object.freeze([
  ["motion","Harmonic motion"],["recurrence","Recurrence"],["center","Center clarity"],
  ["collection","Collection adherence"],["diversity","Pitch diversity"],["activity","Surface activity"]
]);
const clamp01=(x)=>Math.max(0,Math.min(1,Number(x)||0));
const norm=(a)=>{const v=Array.from({length:12},(_,i)=>Math.max(0,Number(a?.[i])||0));const s=v.reduce((x,y)=>x+y,0)||1;return v.map(x=>x/s);};
const cosine=(a,b)=>{let d=0,aa=0,bb=0;for(let i=0;i<12;i++){d+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?d/Math.sqrt(aa*bb):0;};
const el=(tag,cls,text="")=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};

export function deriveAudioFingerprint({title,analysis,harmony,collectionCandidate}){
  const frames=analysis?.frames||[], chroma=norm(analysis?.overallChroma);let motion=0;
  for(let i=1;i<frames.length;i++)motion+=1-cosine(norm(frames[i-1].chroma),norm(frames[i].chroma));
  motion=frames.length>1?motion/(frames.length-1):0;
  const regions=harmony?.regions||[],seen=new Set();let repeat=0,total=0;
  for(const r of regions){const w=Math.max(0,Number(r.duration)||0),k=`${r.rootPc??"?"}:${r.templateId??"?"}`;total+=w;if(seen.has(k))repeat+=w;seen.add(k);}
  const pcs=collectionCandidate?.pcs||[],collection=pcs.reduce((s,pc)=>s+(chroma[((pc%12)+12)%12]||0),0);
  const entropy=-chroma.reduce((s,p)=>p>0?s+p*Math.log(p):s,0)/Math.log(12);
  const minutes=Math.max(Number(analysis?.durationSeconds)||0,1)/60;
  const activity=(analysis?.registeredNoteEvents?.length||analysis?.events?.length||0)/minutes;
  const features=Object.freeze({motion:clamp01(motion/0.25),recurrence:clamp01(total?repeat/total:0),center:clamp01(collectionCandidate?.confidence??collectionCandidate?.relativeWeight??0),collection:clamp01(collection),diversity:clamp01(entropy),activity:clamp01(activity/240)});
  const validChroma=(values)=>Array.isArray(values)&&values.length===12&&values.every(v=>typeof v==="number"&&Number.isFinite(v)&&v>=0)&&values.some(v=>v>0);
  const profileAvailability={
    motion:frames.length>1&&frames.every(frame=>validChroma(frame.chroma)),
    recurrence:regions.length>0&&regions.every(r=>r.rootPc!=null&&r.templateId&&Number(r.duration)>0),
    center:Number.isFinite(collectionCandidate?.confidence??collectionCandidate?.relativeWeight),
    collection:validChroma(analysis?.overallChroma)&&pcs.length>0,
    diversity:validChroma(analysis?.overallChroma),
    activity:Number.isFinite(analysis?.durationSeconds)&&analysis.durationSeconds>0&&((analysis?.registeredNoteEvents?.length||analysis?.events?.length||0)>0)
  };
  return Object.freeze({version:FINGERPRINT_EXPLORER_VERSION,title:String(title||"Untitled"),features,descriptor:derivePairwiseDescriptor({analysis,harmony,fingerprintFeatures:features}),auditDescriptor:deriveEvidenceAwareDescriptor({analysis,harmony,fingerprintFeatures:features,profileAvailability}),evidenceClass:"inferred-from-audio",provenance:Object.freeze({audioVersion:analysis?.version||null,harmonyVersion:harmony?.version||null})});
}
export function fingerprintDistance(a,b){let s=0;for(const [key] of FINGERPRINT_DIMENSIONS)s+=(Number(a?.[key]||0)-Number(b?.[key]||0))**2;return Math.sqrt(s/FINGERPRINT_DIMENSIONS.length);}

export class FingerprintExplorer{
  constructor(root,{storage=globalThis.localStorage}={}){this.root=root;this.storage=storage;this.current=null;this.corpus=this.read();this.inputs={};this.build();this.render();}
  read(){try{return JSON.parse(this.storage?.getItem("harmonic-savant:fingerprint-corpus:v1")||"[]");}catch{return[];}}
  write(){try{this.storage?.setItem("harmonic-savant:fingerprint-corpus:v1",JSON.stringify(this.corpus));}catch{}}
  build(){
    this.root.className="fingerprint-explorer";this.root.innerHTML="";
    const head=el("div","fingerprint-head");head.append(el("div","timeline-title","SAVANT FINGERPRINT"));
    this.save=el("button","fingerprint-save","Save piece");this.save.type="button";this.save.disabled=true;this.save.onclick=()=>this.saveCurrent();
    const menu=document.createElement("details");menu.className="fingerprint-menu";const summary=el("summary","","•••");summary.setAttribute("aria-label","Fingerprint library options");
    this.clear=el("button","fingerprint-danger","Clear saved corpus");this.clear.type="button";this.clear.onclick=e=>{e.preventDefault();this.corpus=[];this.write();menu.open=false;this.render();};menu.append(summary,this.clear);head.append(this.save,menu);this.root.append(head);
    this.currentCard=el("section","fingerprint-current");this.nearestTitle=el("div","fingerprint-section-title","PAIRWISE MUSICAL DISTANCE");this.results=el("div","fingerprint-results");this.root.append(this.currentCard,this.nearestTitle,this.results);
    const modeLabel=el("label","pairwise-mode","Comparison method ");
    this.comparisonMode=document.createElement("select");
    for(const [value,label] of [["audit","Evidence-aware (experimental)"],["original","Original HHF-3.9"]]){const option=el("option","",label);option.value=value;this.comparisonMode.append(option);}
    this.comparisonMode.onchange=()=>this.renderPairwise();modeLabel.append(this.comparisonMode);this.root.insertBefore(modeLabel,this.results);
    this.custom=document.createElement("details");this.custom.className="fingerprint-custom";this.customSummary=el("summary","","Explore descriptive profile only");
    const intro=el("div","fingerprint-custom-note","These sliders search the six-bar descriptive fingerprint only. They are not the musical-identity distance model.");
    const grid=el("div","fingerprint-grid");
    for(const [key,label] of FINGERPRINT_DIMENSIONS){const row=el("label","fingerprint-control"),name=el("span","control-label",label),input=document.createElement("input"),value=el("span","fingerprint-value","50");input.type="range";input.min="0";input.max="100";input.value="50";input.oninput=()=>{value.textContent=input.value;this.renderProfileSearch();};this.inputs[key]=input;row.append(name,input,value);grid.append(row);}
    this.custom.append(this.customSummary,intro,grid);this.root.append(this.custom);
  }
  accept(detail){this.current=deriveAudioFingerprint(detail);this.save.disabled=false;for(const [k] of FINGERPRINT_DIMENSIONS)this.inputs[k].value=String(Math.round(100*this.current.features[k]));this.render();}
  saveCurrent(){if(!this.current)return;const item={...this.current,id:`${Date.now()}:${this.current.title}`},i=this.corpus.findIndex(x=>x.title===item.title);if(i>=0)this.corpus[i]=item;else this.corpus.push(item);this.write();this.render();this.save.textContent="Saved";setTimeout(()=>this.save.textContent="Save piece",900);}
  render(){
    this.clear.disabled=!this.corpus.length;this.currentCard.innerHTML="";
    if(!this.current){this.currentCard.append(el("div","fingerprint-empty-title","Analyze a piece to create its Savant fingerprint"),el("div","fingerprint-empty-copy","Pairwise identity metrics require newly analyzed pieces with registered-note and harmonic-region evidence."));this.save.disabled=true;}
    else{const title=el("div","fingerprint-piece-title",this.current.title),evidence=el("div","fingerprint-evidence","DESCRIPTIVE PROFILE · INFERRED FROM LOCAL AUDIO"),metrics=el("div","fingerprint-metrics");for(const [key,label] of FINGERPRINT_DIMENSIONS){const value=Math.round(100*this.current.features[key]),row=el("div","fingerprint-metric"),name=el("span","fingerprint-metric-name",label),track=el("span","fingerprint-meter"),fill=el("span","fingerprint-meter-fill"),number=el("strong","fingerprint-metric-value",String(value));fill.style.width=`${value}%`;track.append(fill);row.append(name,track,number);metrics.append(row);}this.currentCard.append(title,evidence,metrics);}
    this.renderPairwise();
  }
  renderPairwise(){
    this.results.innerHTML="";this.nearestTitle.textContent="MUSICAL EVIDENCE COMPARISON";
    if(!this.current?.descriptor){this.results.append(el("div","fingerprint-empty-copy","Analyze a piece to compare musical identity."));return;}
    const audited=this.comparisonMode.value==="audit";
    const other=this.corpus.filter(x=>x.title!==this.current.title);
    const comparable=other.filter(x=>audited?x.auditDescriptor?.version===EVIDENCE_AWARE_VERSION:Boolean(x.descriptor));
    const legacy=other.length-comparable.length;
    const calibration=this.corpus.map(x=>audited?x.auditDescriptor:x.descriptor).filter(Boolean);
    const ranked=comparable.map(x=>({...x,cmp:audited?compareEvidenceAwareDescriptors(this.current.auditDescriptor,x.auditDescriptor):comparePairwiseDescriptors(this.current.descriptor,x.descriptor)})).filter(x=>Number.isFinite(x.cmp.distance)).sort((a,b)=>a.cmp.distance-b.cmp.distance).slice(0,5);
    this.results.append(el("div","pairwise-note",audited?"Experimental summary comparison. Family indices are 0–100 scales, not percentages of shared music. Chord order is reported separately and does not change the ranking.":"Original summary comparison. This method can overlook changed chord order and missing evidence; use the experimental audit to inspect those limitations."));
    if(legacy)this.results.append(el("div","pairwise-warning",`${legacy} saved piece(s) need re-analysis for this method. Existing saved records are preserved.`));
    if(!ranked.length){this.results.append(el("div","fingerprint-empty-copy",comparable.length?"No shared usable evidence. Missing notes or chords are not a match.":"Save this piece, then analyze and save another piece."));return;}
    for(let i=0;i<ranked.length;i++){
      const item=ranked[i],card=el("article","pairwise-card"),top=el("div","pairwise-head"),rank=el("span","fingerprint-rank",`#${i+1}`),name=el("strong","fingerprint-name",item.title),dist=el("span","pairwise-distance",`summary distance ${item.cmp.distance.toFixed(3)}`);top.append(rank,name,dist);
      const family=el("div","pairwise-families");for(const [key,label] of [["material","Material"],["structural","Structure"],["stylistic","Style"]]){const v=item.cmp.similarityIndex[key],box=el("div","pairwise-family");box.append(el("span","pairwise-label",label),el("strong","pairwise-score",v==null?"—":String(Math.round(v*100))));family.append(box);}
      const cal=audited?evidenceAwareCorpusPercentile(item.cmp,calibration):corpusSimilarityPercentile(item.cmp.distance,calibration);
      const pending=audited?"Corpus percentile pending · need 10 saved-library pairs with matching evidence coverage.":"Corpus percentile pending · need 10 saved-library pair comparisons.";
      const note=el("div","pairwise-note",cal?`Library similarity percentile: ${cal.percentile.toFixed(0)}th · ${cal.pairCount} saved-library pairs${audited?" with matching evidence coverage":""}. This is library-relative.`:pending);
      card.append(top,family,note);this.results.append(card);
      if(audited){
        const coverage=item.cmp.coverage,order=item.cmp.orderedHarmony;
        card.append(el("div",coverage.missing.length?"pairwise-warning":"pairwise-note",`Evidence: ${coverage.available.length}/${coverage.total} summary components.${coverage.missing.length?` Unavailable: ${coverage.missing.join(", ")}.`:""} Registered top line is an audio proxy, not verified melody.`));
        card.append(el("div","pairwise-order",order.distance==null?`Chord-order distance unavailable: ${order.reason==="COMPUTE_LIMIT"?"sequence exceeds the computation limit":"complete timed root/chord labels are missing"}.`:`Chord-order distance ${order.distance.toFixed(3)} · ${order.edits} edit(s) across ${order.regionsA}/${order.regionsB} regions · shift saved piece by ${order.shiftBToA} semitones. 0 means identical order under one global transposition.`));
      }
    }
  }
  renderProfileSearch(){
    if(!this.custom.open)return;const target=Object.fromEntries(FINGERPRINT_DIMENSIONS.map(([k])=>[k,Number(this.inputs[k].value)/100]));
    const ranked=this.corpus.map(x=>({...x,d:fingerprintDistance(target,x.features)})).sort((a,b)=>a.d-b.d).slice(0,5);
    this.results.innerHTML="";this.nearestTitle.textContent="DESCRIPTIVE PROFILE SEARCH";
    for(let i=0;i<ranked.length;i++){const row=el("div","fingerprint-result");row.append(el("span","fingerprint-rank",`#${i+1}`),el("span","fingerprint-name",ranked[i].title),el("span","fingerprint-distance",`profile distance ${ranked[i].d.toFixed(3)}`));this.results.append(row);}
  }
}
