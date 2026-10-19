import { buildCompositionContext, createPassage } from "../analysis/composition-context.js";
import { COMPOSITION_INTENTIONS } from "../continuation/composition-score.js";
import { readPassageLibrary, savePassage } from "../model/passage-library.js";
import { compositionReport, compositionCSV, compositionMarkdown } from "../analysis/composition-export.js";
import { downloadArtifact } from "./workspace-backup-panel.js";
import { ChordAudition, generatedAuditionVoicing } from "../playback/audition.js";
import { readFeelingNotes } from "../model/feeling-notes.js";
import { PROGRESSION_REFERENCES } from "../catalog/progression-references.js";
import { pitchClassName } from "../theory/pitch.js";
const make=(tag,text="",className="")=>{const n=document.createElement(tag);n.textContent=text;n.className=className;return n;};
const button=(label,action)=>{const b=make("button",label,"hs-secondary");b.type="button";b.onclick=action;return b;};
const field=(label,input)=>{const l=make("label","","hs-field");l.append(make("span",label,"hs-field-label"),input);return l;};
function select(label,options){const s=make("select");s.setAttribute("aria-label",label);for(const [value,text]of options){const o=make("option",text);o.value=value;s.append(o);}return s;}

export class CompositionWorkbench {
  constructor(panel,{getSourceEvidence=()=>null,onAuditionStart=()=>{}}={}) {
    this.panel=panel;this.getSourceEvidence=getSourceEvidence;this.onAuditionStart=onAuditionStart;this.audition=new ChordAudition();this.startIndex=null;this.searchResults=[];
    this.root=make("section","","composition-workbench");this.root.setAttribute("aria-label","Composition and passage laboratory");
    this.root.append(make("h3","Composition & passage laboratory"));
    const grid=make("div","","hs-form-grid");
    this.engine=select("Continuation method",[["composition","Composition context · experimental"],["local","Local chord baseline"]]);
    this.mode=select("Composition evidence context",[["compose-forward","Compose-forward · through selection"],["analyze-reharmonize","Analyze / reharmonize · whole composition"]]);
    this.intention=select("Compositional intention",Object.keys(COMPOSITION_INTENTIONS).map(k=>[k,k[0].toUpperCase()+k.slice(1)]));
    this.modulation=select("Modulation target",["C","Db","D","Eb","E","F","F#","G","Ab","A","Bb","B"].map(k=>[k,k+" major"]));this.modulation.value="D";
    this.first=make("input");this.first.type="number";this.first.min="1";this.first.step="1";this.first.value="1";this.first.className="hs-input";this.first.setAttribute("aria-label","Passage first chord");
    this.last=make("input");this.last.type="number";this.last.min="1";this.last.step="1";this.last.value="1";this.last.className="hs-input";this.last.setAttribute("aria-label","Passage last chord");
    grid.append(field("Continuation method",this.engine),field("Evidence context",this.mode),field("Compositional intention",this.intention),field("Modulation target",this.modulation),field("Passage first chord",this.first),field("Passage last chord",this.last));
    this.definition=make("p","","hs-small-note composition-scope");this.summary=make("div","","composition-summary");this.status=make("p","","hs-action-status");this.status.setAttribute("aria-live","polite");
    const actions=make("div","","hs-actions");
    actions.append(button("Start passage at selected chord",()=>{this.startIndex=panel.selectedIndex;this.first.value=String(this.startIndex+1);panel.follow.checked=false;panel.invalidateAnalysis();this.refresh();if(panel.progression.value)panel.run();}),
      button("Select passage",()=>this.selectPassage()),button("Save passage on this device",()=>this.save()),button("Find related passages",()=>this.search()));
    const exports=make("div","","hs-actions");
    for(const [label,type]of [["Export passage JSON","json"],["Export passage CSV","csv"],["Export passage report","md"]])exports.append(button(label,()=>this.export(type)));
    this.target=select("Translate functions to target key",[["","Original context"],...["C","Db","D","Eb","E","F","F#","G","Ab","A","Bb","B"].map(k=>[k,k])]);
    this.target.onchange=()=>{panel.targetTonic.value=this.target.value;panel.invalidateAnalysis();panel.run();};
    this.searchOutput=make("div","","composition-search-results");this.searchOutput.setAttribute("aria-live","polite");
    const constraints=make("details","","hs-advanced");constraints.append(make("summary","Generated sound and register"));
    this.low=make("input");this.low.type="number";this.low.min="21";this.low.max="108";this.low.value="48";this.low.className="hs-input";this.low.setAttribute("aria-label","Generated voicing lowest MIDI note");
    this.high=make("input");this.high.type="number";this.high.min="21";this.high.max="108";this.high.value="84";this.high.className="hs-input";this.high.setAttribute("aria-label","Generated voicing highest MIDI note");
    const range=make("div","","hs-form-grid");range.append(field("Lowest MIDI note · piano range",this.low),field("Highest MIDI note · piano range",this.high));constraints.append(range,make("p","Generated previews use equal-tempered sine tones in the declared piano register. They pause the original recording and never alter its notes or claim to reproduce its touch.","hs-small-note"),button("Stop generated sound",()=>this.audition.stop()));
    const semantics=make("details","","hs-advanced");semantics.append(make("summary","Explore annotated musical character"));
    this.words=make("input");this.words.className="hs-input";this.words.placeholder="Search personal or source-attributed descriptions";this.words.setAttribute("aria-label","Search musical descriptions");this.words.maxLength=100;
    this.semanticScope=select("Description source",[["personal","My personal notes"],["editorial","Attributed reference descriptions"]]);
    this.semanticOutput=make("div","","composition-semantic-results");
    semantics.append(field("Description source",this.semanticScope),field("Words or phrase",this.words),button("Find annotated examples",()=>this.searchDescriptions()),this.semanticOutput,
      make("p","Annotation retrieval only. Personal responses and source descriptions can disagree. No validated emotion predictor or population model is available.","hs-small-note"));
    this.root.append(grid,this.definition,actions,this.summary,field("Translate functional interpretation",this.target),constraints,exports,this.status,this.searchOutput,semantics);
    panel.songControls.append(this.root);
    for(const control of [this.engine,this.mode,this.intention,this.modulation,this.low,this.high])control.addEventListener("change",()=>{this.searchResults=[];panel.invalidateAnalysis();this.refresh();if(panel.progression.value)panel.run();});
  }
  events(){const source=this.getSourceEvidence();return source?.sourceId===this.panel.song?.sourceId?source.events||[]:[];}
  onSelection(){this.audition.stop();this.searchResults=[];this.searchOutput.replaceChildren();this.last.value=String(this.panel.selectedIndex+1);this.first.max=this.last.max=String(this.panel.song?.regions.length||1);if(this.startIndex===null||this.startIndex>this.panel.selectedIndex)this.startIndex=this.panel.selectedIndex;this.first.value=String(this.startIndex+1);this.refresh();}
  reset(){this.audition.stop();this.startIndex=null;this.searchResults=[];this.searchOutput.replaceChildren();this.summary.replaceChildren();this.root.hidden=true;}
  selection(){const p=this.panel;if(!p.song||p.selectedIndex<0)throw new Error("Select a sounding song chord first");return {song:p.song,startIndex:this.startIndex??p.selectedIndex,endIndex:p.selectedIndex};}
  context(){const {song,startIndex,endIndex}=this.selection();return buildCompositionContext(song,endIndex,{mode:this.mode.value,startIndex,events:this.events()});}
  options(){
    if(this.panel.sourceMode.value!=="song"||this.engine.value==="local")return {};
    const low=Number(this.low.value),high=Number(this.high.value);if(!Number.isInteger(low)||!Number.isInteger(high)||low<21||high>108||low>high)throw new Error("Choose a piano register within MIDI21–108");
    return {compositionContext:this.context(),intention:this.intention.value,modulationTonic:this.modulation.value,voicingPolicy:{midiRange:[low,high]}};
  }
  refresh(){
    this.root.hidden=this.panel.sourceMode.value!=="song"||!this.panel.song;
    this.panel.preset.disabled=this.engine.value!=="local"&&this.panel.sourceMode.value==="song";
    this.panel.preset.closest("label").querySelector(".hs-field-help").textContent=this.panel.preset.disabled?"Local baseline preset is inactive while composition-intention weights determine ranking.":"Visible local objective; unavailable corpus/style evidence stays unknown.";
    this.definition.textContent=COMPOSITION_INTENTIONS[this.intention.value].definition+" "+(this.engine.value==="local"?"Local baseline ignores the additional composition ranking.":"Composition ranking is additive and experimental; its components and weights are shown below.");
    this.modulation.disabled=this.intention.value!=="modulate";
    try{const c=this.context(),f=c.features;this.summary.replaceChildren(make("p",c.scope,"composition-scope"),make("p",`Selected passage ${c.startIndex+1}–${c.selectedIndex+1}; context regions1–${c.contextEndIndex+1}. ${c.futureInformsAnalysis?"Future source evidence informs this result.":"Future source evidence excluded."}`),
      make("p",`Root-motif continuations: ${f.motifMatches.length} prior examples. Selected hold: ${f.selectedDuration.toFixed(2)}s (${f.relativeHold.toFixed(2)} × context mean). Register: ${f.registeredRange?f.registeredRange.join("–")+" MIDI":"unavailable"}. ${c.evidence.motif}.`),
      make("p",`Center hypotheses: ${c.centerCandidates.map(x=>pitchClassName(x.centerPc)).join(", ")}; inferred from this context. Form: ${c.evidence.form}.`));this.status.textContent="";}catch(error){this.summary.textContent=error.message;}
  }
  selectPassage(){try{const first=Number(this.first.value)-1,last=Number(this.last.value)-1;createPassage(this.panel.song,first,last);this.startIndex=first;this.panel.follow.checked=false;this.panel.select(last,{seek:true,force:true});}catch(error){this.status.textContent=error.message;}}
  save(){try{const s=this.selection(),records=savePassage(this.panel.storage,createPassage(s.song,s.startIndex,s.endIndex));this.status.textContent=`Passage saved locally · ${records.length}/64 saved passages. Workspace backup includes these records.`;}catch(error){this.status.textContent=`Could not save passage: ${error.message}`;}}
  search(){
    try{const s=this.selection(),query=createPassage(s.song,s.startIndex,s.endIndex),records=readPassageLibrary(this.panel.storage);this.searchOutput.textContent="Searching sequence-bearing evidence locally…";
      this.panel.request({type:"passage-search",query,sources:[s.song,...records.map(r=>r.passage)]},result=>{
        this.panel.actionStatus.textContent="Passage search ready · explore next chords to refresh continuation if needed.";
        this.searchResults=result.matches;this.searchOutput.replaceChildren(make("p","Equal-length ordered pitch-set search over current song and saved passages. Lower distances mean closer under that feature. One global transposition; no smoothed or fabricated alignment."));
        if(!result.matches.length)this.searchOutput.append(make("p","No eligible non-overlapping passage found. Save passages from another source or select a shorter interval. The500-reference summary catalog cannot supply passage locations."));
        for(const hit of result.matches){const d=hit.comparison,row=make("article","","composition-match");row.append(make("strong",`${hit.title} · chords${hit.startIndex+1}–${hit.endIndex+1}`),make("p",`${hit.onset.toFixed(2)}–${hit.end.toFixed(2)}s · transpose +${d.shiftBToA} semitones · ordered pitch sets${d.pitchSetDistance.toFixed(3)} · root/chord order${d.rootOrderDistance===null?"unavailable":d.rootOrderDistance.toFixed(3)} · relative rhythm${d.relativeRhythmDistance.toFixed(3)}`));const details=make("details");details.append(make("summary","Inspect exact region alignment"),make("pre",JSON.stringify(d.alignment,null,2)));row.append(details);this.searchOutput.append(row);}
      },message=>{this.searchOutput.textContent=`Search unavailable: ${message}`;});
    }catch(error){this.status.textContent=`Search unavailable: ${error.message}`;}
  }
  export(type){try{const s=this.selection(),report=compositionReport(s.song,s.startIndex,s.endIndex,{context:this.panel.session?.composition?.context??null,session:this.panel.session,searchResults:this.searchResults,events:this.events()});
    downloadArtifact(type==="json"?report:type==="csv"?compositionCSV(report):compositionMarkdown(report),`Harmonic_Passage.${type}`,type==="csv"?"text/csv;charset=utf-8":type==="md"?"text/markdown;charset=utf-8":"application/json");this.status.textContent="Passage export downloaded; source music is unchanged.";
    }catch(error){this.status.textContent=`Could not export: ${error.message}`;}}
  async preview(entry,rank){try{const range=[Number(this.low.value),Number(this.high.value)],notes=generatedAuditionVoicing(entry.candidate,entry.dimensions.voiceLeading.bestVoicing,{midiRange:range});await this.audition.play(notes,{seconds:rank?.composition?.suggestedDurationSeconds||1,onStart:this.onAuditionStart});this.status.textContent=`Generated preview: MIDI${notes.join(", ")}. Original recording paused; source unchanged.`;}catch(error){this.status.textContent=`Preview unavailable: ${error.message}`;}}
  searchDescriptions(){
    const query=this.words.value.trim().toLowerCase();this.semanticOutput.replaceChildren();
    try{if(this.semanticScope.value==="personal"){
      const notes=readFeelingNotes(this.panel.storage,{strict:true}).filter(n=>!query||n.tags.some(t=>t.label.toLowerCase().includes(query)));
      for(const note of notes.slice(0,30))this.semanticOutput.append(make("p",`${note.tags.map(t=>t.label).join(", ")} · source${note.sourceId} · ${note.onsetSeconds.toFixed(2)}–${note.endSeconds.toFixed(2)}s · ${note.chord||"unresolved"} · personal reaction, ${note.createdAt}`));
      if(!notes.length)this.semanticOutput.append(make("p","No personal annotations match this text. Save your reaction to a selected moment below."));
    }else{const refs=PROGRESSION_REFERENCES.filter(r=>!query||r.tags.some(t=>t.toLowerCase().includes(query)));
      for(const ref of refs){const row=make("p",`${ref.title} — ${ref.artist}: ${ref.tags.join(", ")||"no source descriptors"}. `),link=make("a","Attributed source");link.href=ref.url;link.target="_blank";link.rel="noopener noreferrer";row.append(link);this.semanticOutput.append(row);}
      if(!refs.length)this.semanticOutput.append(make("p","No matching source-attributed tags in the five-reference pilot."));
    }}catch(error){this.semanticOutput.textContent=`Annotations unavailable: ${error.message}`;}
  }
}
