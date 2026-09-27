export const FINGERPRINT_EXPLORER_VERSION = "fingerprint-explorer-beta-v2";
export const FINGERPRINT_DIMENSIONS = Object.freeze([
  ["motion","Harmonic motion"],["recurrence","Recurrence"],["center","Center clarity"],
  ["collection","Collection adherence"],["diversity","Pitch diversity"],["activity","Surface activity"]
]);
const clamp01=(x)=>Math.max(0,Math.min(1,Number(x)||0));
const norm=(a)=>{const v=Array.from({length:12},(_,i)=>Math.max(0,Number(a?.[i])||0));const s=v.reduce((x,y)=>x+y,0)||1;return v.map(x=>x/s);};
const cosine=(a,b)=>{let d=0,aa=0,bb=0;for(let i=0;i<12;i++){d+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?d/Math.sqrt(aa*bb):0;};
const el=(tag,cls,text="")=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};

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

export class FingerprintExplorer {
  constructor(root,{storage=globalThis.localStorage}={}){
    this.root=root;this.storage=storage;this.current=null;this.corpus=this.read();this.inputs={};this.build();this.render();
  }
  read(){try{return JSON.parse(this.storage?.getItem("harmonic-savant:fingerprint-corpus:v1")||"[]");}catch{return[];}}
  write(){try{this.storage?.setItem("harmonic-savant:fingerprint-corpus:v1",JSON.stringify(this.corpus));}catch{}}
  build(){
    this.root.className="fingerprint-explorer";this.root.innerHTML="";
    const head=el("div","fingerprint-head");
    head.append(el("div","timeline-title","SAVANT FINGERPRINT"));
    this.save=el("button","fingerprint-save","Save piece");this.save.type="button";this.save.disabled=true;this.save.onclick=()=>this.saveCurrent();
    const menu=document.createElement("details");menu.className="fingerprint-menu";
    const menuSummary=el("summary","","•••");menuSummary.setAttribute("aria-label","Fingerprint library options");
    this.clear=el("button","fingerprint-danger","Clear saved corpus");this.clear.type="button";
    this.clear.onclick=(event)=>{event.preventDefault();this.corpus=[];this.write();menu.open=false;this.render();};
    menu.append(menuSummary,this.clear);head.append(this.save,menu);this.root.append(head);

    this.currentCard=el("section","fingerprint-current");
    this.root.append(this.currentCard);

    this.nearestTitle=el("div","fingerprint-section-title","CLOSEST SAVED PIECES");
    this.results=el("div","fingerprint-results");
    this.root.append(this.nearestTitle,this.results);

    this.custom=document.createElement("details");this.custom.className="fingerprint-custom";
    this.customSummary=el("summary","","Explore a custom fingerprint");
    const intro=el("div","fingerprint-custom-note","Move the sliders to search your saved corpus by a synthetic harmonic profile.");
    const grid=el("div","fingerprint-grid");
    for(const [key,label] of FINGERPRINT_DIMENSIONS){
      const row=el("label","fingerprint-control"),name=el("span","control-label",label),input=document.createElement("input"),value=el("span","fingerprint-value","50");
      input.type="range";input.min="0";input.max="100";input.value="50";
      input.oninput=()=>{value.textContent=input.value;this.renderNearest(true);};
      this.inputs[key]=input;row.append(name,input,value);grid.append(row);
    }
    this.custom.append(this.customSummary,intro,grid);this.root.append(this.custom);
  }
  accept(detail){
    this.current=deriveAudioFingerprint(detail);this.save.disabled=false;this.setTarget(this.current.features);this.render();
  }
  setTarget(features){for(const [key] of FINGERPRINT_DIMENSIONS){this.inputs[key].value=String(Math.round(100*clamp01(features?.[key])));}}
  target(){return Object.fromEntries(FINGERPRINT_DIMENSIONS.map(([key])=>[key,Number(this.inputs[key].value)/100]));}
  saveCurrent(){
    if(!this.current)return;
    const item={...this.current,id:`${Date.now()}:${this.current.title}`};
    const i=this.corpus.findIndex(x=>x.title===item.title);if(i>=0)this.corpus[i]=item;else this.corpus.push(item);
    this.write();this.render();this.save.textContent="Saved";
    setTimeout(()=>{this.save.textContent="Save piece";},900);
  }
  render(){
    this.clear.disabled=!this.corpus.length;
    this.currentCard.innerHTML="";
    if(!this.current){
      this.currentCard.append(
        el("div","fingerprint-empty-title","Analyze a piece to create its Savant fingerprint"),
        el("div","fingerprint-empty-copy","The report will appear here automatically after local audio analysis.")
      );
      this.save.disabled=true;
    }else{
      const title=el("div","fingerprint-piece-title",this.current.title);
      const evidence=el("div","fingerprint-evidence","INFERRED FROM LOCAL AUDIO");
      const metrics=el("div","fingerprint-metrics");
      for(const [key,label] of FINGERPRINT_DIMENSIONS){
        const value=Math.round(100*clamp01(this.current.features[key]));
        const row=el("div","fingerprint-metric");
        const name=el("span","fingerprint-metric-name",label),track=el("span","fingerprint-meter"),fill=el("span","fingerprint-meter-fill"),number=el("strong","fingerprint-metric-value",String(value));
        fill.style.width=`${value}%`;track.append(fill);row.append(name,track,number);metrics.append(row);
      }
      this.currentCard.append(title,evidence,metrics);
    }
    this.renderNearest(false);
  }
  renderNearest(custom=false){
    if(!this.results)return;this.results.innerHTML="";
    const target=custom?this.target():this.current?.features;
    if(!target){
      this.nearestTitle.textContent="CLOSEST SAVED PIECES";
      this.results.append(el("div","fingerprint-empty-copy","Save analyzed pieces to build your local comparison library."));
      return;
    }
    this.nearestTitle.textContent=custom?"CUSTOM TARGET · CLOSEST SAVED PIECES":"CLOSEST SAVED PIECES";
    const ranked=this.corpus
      .filter(x=>custom||x.title!==this.current?.title)
      .map(x=>({...x,d:fingerprintDistance(target,x.features)}))
      .sort((a,b)=>a.d-b.d).slice(0,5);
    if(!ranked.length){
      this.results.append(el("div","fingerprint-empty-copy",this.corpus.length?"No other saved pieces yet. Save another analyzed piece to compare.":"Save this piece, then analyze another to begin comparison."));
      return;
    }
    ranked.forEach((item,i)=>{
      const row=el("div","fingerprint-result"),rank=el("span","fingerprint-rank",`#${i+1}`),name=el("span","fingerprint-name",item.title),score=el("span","fingerprint-distance",`${Math.round(100*clamp01(1-item.d))}% similar`);
      row.append(rank,name,score);this.results.append(row);
    });
  }
}
