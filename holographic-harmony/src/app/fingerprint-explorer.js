export const FINGERPRINT_EXPLORER_VERSION = "fingerprint-explorer-beta-v1";
export const FINGERPRINT_DIMENSIONS = Object.freeze([
  ["motion","Harmonic motion"],["recurrence","Recurrence"],["center","Center clarity"],
  ["collection","Collection adherence"],["diversity","Pitch diversity"],["activity","Surface activity"]
]);
const clamp01=(x)=>Math.max(0,Math.min(1,Number(x)||0));
const norm=(a)=>{const v=Array.from({length:12},(_,i)=>Math.max(0,Number(a?.[i])||0));const s=v.reduce((x,y)=>x+y,0)||1;return v.map(x=>x/s);};
const cosine=(a,b)=>{let d=0,aa=0,bb=0;for(let i=0;i<12;i++){d+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?d/Math.sqrt(aa*bb):0;};

export function deriveAudioFingerprint({title,analysis,harmony,collectionCandidate}){
  const frames=analysis?.frames||[], chroma=norm(analysis?.overallChroma);
  let motion=0;
  for(let i=1;i<frames.length;i++) motion+=1-cosine(norm(frames[i-1].chroma),norm(frames[i].chroma));
  motion=frames.length>1?motion/(frames.length-1):0;
  const regions=harmony?.regions||[], seen=new Set(); let repeat=0,total=0;
  for(const r of regions){const w=Math.max(0,Number(r.duration)||0),k=`${r.rootPc??"?"}:${r.templateId??"?"}`;total+=w;if(seen.has(k))repeat+=w;seen.add(k);}
  const pcs=collectionCandidate?.pcs||[], collection=pcs.reduce((s,pc)=>s+(chroma[((pc%12)+12)%12]||0),0);
  const entropy=-chroma.reduce((s,p)=>p>0?s+p*Math.log(p):s,0)/Math.log(12);
  const minutes=Math.max(Number(analysis?.durationSeconds)||0,1)/60;
  const activity=(analysis?.registeredNoteEvents?.length||analysis?.events?.length||0)/minutes;
  return Object.freeze({
    version:FINGERPRINT_EXPLORER_VERSION,title:String(title||"Untitled"),
    features:Object.freeze({
      motion:clamp01(motion/0.25),recurrence:clamp01(total?repeat/total:0),
      center:clamp01(collectionCandidate?.confidence??collectionCandidate?.relativeWeight??0),
      collection:clamp01(collection),diversity:clamp01(entropy),activity:clamp01(activity/240)
    }),
    evidenceClass:"inferred-from-audio",
    provenance:Object.freeze({audioVersion:analysis?.version||null,harmonyVersion:harmony?.version||null})
  });
}
export function fingerprintDistance(a,b,weights={}){
  let sum=0,ws=0;
  for(const [key] of FINGERPRINT_DIMENSIONS){const w=Math.max(0,Number(weights[key]??1));sum+=w*(Number(a?.[key]||0)-Number(b?.[key]||0))**2;ws+=w;}
  return ws?Math.sqrt(sum/ws):Infinity;
}
const el=(tag,cls,text="")=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};

export class FingerprintExplorer {
  constructor(root,{storage=globalThis.localStorage}={}){
    this.root=root;this.storage=storage;this.current=null;this.corpus=this.read();this.inputs={};this.build();this.renderCorpus();
  }
  read(){try{return JSON.parse(this.storage?.getItem("harmonic-savant:fingerprint-corpus:v1")||"[]");}catch{return[];}}
  write(){try{this.storage?.setItem("harmonic-savant:fingerprint-corpus:v1",JSON.stringify(this.corpus));}catch{}}
  build(){
    this.root.className="fingerprint-explorer";this.root.innerHTML="";
    const head=el("div","fingerprint-head"),title=el("div","timeline-title","SAVANT FINGERPRINT EXPLORER · LOCAL BETA");
    this.status=el("div","fingerprint-status","Analyze local audio, then save its fingerprint. Nothing is uploaded.");
    this.save=el("button","open-file-button","Save current");this.save.disabled=true;this.save.onclick=()=>this.saveCurrent();
    this.clear=el("button","fingerprint-secondary","Clear corpus");this.clear.onclick=()=>{this.corpus=[];this.write();this.renderCorpus();};
    head.append(title,this.save,this.clear);this.root.append(head,this.status);
    const grid=el("div","fingerprint-grid");
    for(const [key,label] of FINGERPRINT_DIMENSIONS){const row=el("label","fingerprint-control"),name=el("span","control-label",label),input=document.createElement("input"),value=el("span","fingerprint-value","50");input.type="range";input.min="0";input.max="100";input.value="50";input.oninput=()=>{value.textContent=input.value;this.renderNearest();};this.inputs[key]=input;row.append(name,input,value);grid.append(row);}
    this.root.append(grid);this.results=el("div","fingerprint-results");this.root.append(this.results);
  }
  accept(detail){
    this.current=deriveAudioFingerprint(detail);this.save.disabled=false;this.status.textContent=`${this.current.title} · inferred local fingerprint ready`;
    this.setTarget(this.current.features);this.renderNearest();
  }
  setTarget(features){for(const [key] of FINGERPRINT_DIMENSIONS)this.inputs[key].value=String(Math.round(100*clamp01(features?.[key])));}
  target(){return Object.fromEntries(FINGERPRINT_DIMENSIONS.map(([key])=>[key,Number(this.inputs[key].value)/100]));}
  saveCurrent(){
    if(!this.current)return;
    const item={...this.current,id:`${Date.now()}:${this.current.title}`};
    const i=this.corpus.findIndex(x=>x.title===item.title);if(i>=0)this.corpus[i]=item;else this.corpus.push(item);
    this.write();this.renderCorpus();this.status.textContent=`${item.title} saved locally · ${this.corpus.length} piece corpus`;
  }
  renderCorpus(){this.clear.disabled=!this.corpus.length;this.renderNearest();}
  renderNearest(){
    if(!this.results)return;this.results.innerHTML="";
    if(!this.corpus.length){this.results.append(el("div","diag-sub","Save at least one analyzed piece to start nearest-neighbor search."));return;}
    const target=this.target();
    this.corpus.map(x=>({...x,d:fingerprintDistance(target,x.features)})).sort((a,b)=>a.d-b.d).slice(0,5).forEach((item,i)=>{
      const row=el("button","fingerprint-result"),rank=el("span","fingerprint-rank",`#${i+1}`),name=el("span","fingerprint-name",item.title),score=el("span","fingerprint-distance",`${Math.round(100*clamp01(1-item.d))}% similarity`);
      row.type="button";row.onclick=()=>{this.setTarget(item.features);this.renderNearest();};row.append(rank,name,score);this.results.append(row);
    });
  }
}
