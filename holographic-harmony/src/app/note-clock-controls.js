import { SCALE_SYSTEMS } from '../inference/scales.js';
import { CLOCK_TONICS, NOTE_CLOCK_VERSION, NoteClockMemory, makeClockKey } from '../visualization/note-clock-state.js';
import { browserStorage } from './browser-storage.js';

const STORE='harmonic-savant:note-clock-choices:v1';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
function select(label,items){const wrap=el('label','clock-control'),input=el('select');input.setAttribute('aria-label',label);for(const [value,text]of items){const o=el('option','',text);o.value=value;input.append(o);}wrap.append(el('span','control-label',label),input);return {wrap,input};}
function readRecords(storage){
  if(!storage)throw new Error('Browser storage is unavailable');
  const raw=storage.getItem(STORE);
  if(raw?.length>2_000_000)throw new Error('Saved clock choices exceed the supported size; existing records were preserved');
  const data=raw?JSON.parse(raw):{version:1,records:[]};
  if(data?.version!==1||!Array.isArray(data.records)||data.records.length>128||data.records.some(r=>typeof r?.sourceId!=='string'||r.sourceId.length>180||r.settings?.version!==NOTE_CLOCK_VERSION)||new Set(data.records.map(r=>r.sourceId)).size!==data.records.length)throw new Error('Unreadable saved clock choices; existing records were preserved');
  return data;
}
export function readClockChoices(storage,sourceId){return readRecords(storage).records.find(r=>r.sourceId===sourceId)?.settings??null;}
export function saveClockChoices(storage,sourceId,settings){
  if(typeof sourceId!=='string'||!sourceId||sourceId.length>180)throw new TypeError('A valid composition source identity is required');
  // Validate every record before rewriting a shared collection, preserving unfamiliar schemas.
  const data=readRecords(storage);for(const r of data.records){const check=new NoteClockMemory([],{center:null,systemId:null,pcs:[],label:'Key unresolved',basis:'Unresolved'});check.restore(r.settings);}
  const check=new NoteClockMemory([],{center:null,systemId:null,pcs:[],label:'Key unresolved',basis:'Unresolved'});check.restore(settings);
  const records=data.records.filter(r=>r.sourceId!==sourceId);if(records.length>=128)throw new Error('128 saved clock sources reached; back up existing choices');
  records.push({sourceId,settings});const text=JSON.stringify({version:1,records});if(text.length>2_000_000)throw new Error('Saved clock choices exceed the supported size');storage.setItem(STORE,text);
}

export class NoteClockControls {
  constructor({getSession,onChange}){
    this.getSession=getSession;this.onChange=onChange;
    this.root=el('div','clock-controls');this.heading=el('div','diag-label','SONG KEY · FIXED REFERENCE');
    this.current=el('div','clock-key-label','—');this.basis=el('p','clock-small','The key stays fixed until you confirm a modulation.');
    this.colors=el('p','clock-colors','Song colors: none heard yet.');
    const detail=el('details','clock-edit');detail.append(el('summary','','Key & note roles'));
    const view=select('Clock view', [['memory','Song key & color memory'],['legacy','Original adaptive field']]);
    this.view=view.input;this.view.onchange=()=>this.onChange();detail.append(view.wrap);
    const grid=el('div','clock-control-grid');
    const tonic=select('Clock tonic',CLOCK_TONICS.map((n,pc)=>[String(pc),n])),system=select('Clock key or mode',SCALE_SYSTEMS.map(s=>[s.id,s.name]));
    this.tonic=tonic.input;this.system=system.input;
    const actions=el('div','clock-actions'),base=el('button','','Set song key'),modulate=el('button','','Confirm modulation here');
    for(const b of[base,modulate])b.type='button';
    base.onclick=()=>this.change(s=>s.model.setKey(makeClockKey(Number(this.tonic.value),this.system.value),0),'Song key set.');
    modulate.onclick=()=>this.change(s=>s.model.setKey(makeClockKey(Number(this.tonic.value),this.system.value,'User-confirmed modulation'),Math.max(0,s.time)),`Modulation confirmed at the selected playback position.`);
    actions.append(base,modulate);grid.append(tonic.wrap,system.wrap);
    const pitch=select('Note to classify',CLOCK_TONICS.map((n,pc)=>[String(pc),n])),role=select('Note role',[
      ['auto','Automatic'],['song-color','Song color'],['transient','Transient / mistake']]);
    this.pitch=pitch.input;this.role=role.input;this.pitch.onchange=()=>this.refreshRole();
    this.role.onchange=()=>this.change(s=>s.model.setRole(Number(this.pitch.value),this.role.value),'Note role updated. Original notes are unchanged.');
    const noteGrid=el('div','clock-control-grid');noteGrid.append(pitch.wrap,role.wrap);
    const note=el('p','clock-small','Outside the key does not mean wrong. Automatic memory counts separate entrances, not octave doublings or tied continuations. Choose a role when you know the intention.');
    this.undo=el('button','','Undo clock edit');this.undo.type='button';this.undo.disabled=true;
    this.undo.onclick=()=>this.change(s=>s.model.undo(),'Clock edit undone.');
    const reset=el('button','','Reset clock choices');reset.type='button';reset.onclick=()=>this.change(s=>s.model.reset(),'Clock choices reset to the source reference.');
    const editActions=el('div','clock-actions');editActions.append(this.undo,reset);
    this.status=el('p','clock-small');this.status.setAttribute('aria-live','polite');
    detail.append(grid,actions,noteGrid,note,editActions,this.status);
    this.root.append(this.heading,this.current,this.basis,this.colors,detail);
  }
  attach(session,sourceId){
    if(!sourceId||session.sourceId===sourceId)return;
    session.sourceId=sourceId;
    try{const saved=readClockChoices(browserStorage(),sourceId);if(saved)session.model.restore(saved);}
    catch(error){session.warning=error.message;}
    this.model=null;
  }
  change(action,message){
    const session=this.getSession();if(!session)return;
    try{
      action(session);this.view.value='memory';this.onChange();this.refreshRole();
      let persistence='Changes apply to this session.';
      if(session.sourceId){try{saveClockChoices(browserStorage(),session.sourceId,session.model.settings());persistence='Saved on this device.';}catch(error){persistence=`Not saved: ${error.message}`;}}
      this.status.textContent=`${message} ${persistence}`;
    }catch(error){this.status.textContent=error.message;}
  }
  selectNote(pc){this.pitch.value=String(pc);this.root.querySelector('details').open=true;this.refreshRole();}
  refreshRole(){const session=this.getSession();if(session)this.role.value=session.model.roles[this.pitch.value]??'auto';}
  update(session,snapshot){
    if(this.model!==session.model){this.model=session.model;this.tonic.value=String(snapshot.key.center??0);this.system.value=snapshot.key.systemId??'major';this.pitch.value=String(snapshot.key.center??0);this.role.value=session.model.roles[this.pitch.value]??'auto';this.status.textContent=session.warning??'';}
    for(let pc=0;pc<12;pc++)if(this.pitch.options[pc].textContent!==snapshot.notes[pc].label)this.pitch.options[pc].textContent=snapshot.notes[pc].label;
    this.current.textContent=snapshot.key.label;
    this.basis.textContent=`${snapshot.key.basis}${snapshot.keySince>0?` · from ${snapshot.keySince.toFixed(2)} s`:''}. Passing tones and borrowed notes do not change this key.`;
    this.colors.textContent=snapshot.retained.length?`Song colors: ${snapshot.retained.map(n=>`${n.label} · ${n.entrances} ${n.entrances===1?'entrance':'entrances'}${n.role==='song-color'?' · chosen':''}`).join(' / ')}`:'Song colors: none retained yet. One-off notes flash, then fade.';
    this.undo.disabled=!session.model.history.length;
  }
  clear(){this.model=null;this.current.textContent='—';this.basis.textContent='Loading source…';this.colors.textContent='';this.status.textContent='';this.undo.disabled=true;}
}
