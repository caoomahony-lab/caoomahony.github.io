import { SCALE_SYSTEMS, inferScaleCandidates } from '../inference/scales.js';
import { computePitchClassActivity } from '../theory/activity.js';
import { pitchClassName, noteName } from '../theory/pitch.js';

export const NOTE_CLOCK_VERSION = 'note-clock-memory-v1';
export const CLOCK_TONICS = Object.freeze(['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']);
const validPc = pc => Number.isInteger(pc) && pc >= 0 && pc < 12;
const glyphs = text => text.replaceAll('#','♯').replaceAll('b','♭');
const sameSet = (a,b) => a.length===b.length && a.every(pc=>b.includes(pc));
const upperBound = (values,time) => { let lo=0,hi=values.length;while(lo<hi){const m=(lo+hi)>>1;if(values[m]<=time)lo=m+1;else hi=m;}return lo; };

export function makeClockKey(center, systemId, basis='User selected') {
  if(!validPc(center)) throw new RangeError('Choose a tonic from the twelve pitch classes');
  const system=SCALE_SYSTEMS.find(s=>s.id===systemId);
  if(!system) throw new TypeError('Choose a supported key or mode');
  return Object.freeze({center,systemId,pcs:Object.freeze(system.intervals.map(i=>(i+center)%12).sort((a,b)=>a-b)),
    label:`${glyphs(CLOCK_TONICS[center])} ${system.name}`,basis});
}

export function initialClockKey(events, declaredField=null) {
  if(declaredField?.pcs?.length){
    const pcs=[...new Set(declaredField.pcs)].sort((a,b)=>a-b);
    if(pcs.some(pc=>!validPc(pc)))throw new TypeError('Invalid declared clock field');
    const center=validPc(declaredField.center)?declaredField.center:null;
    const system=center===null?null:SCALE_SYSTEMS.find(s=>sameSet(pcs,s.intervals.map(i=>(center+i)%12)));
    if(system)return makeClockKey(center,system.id,'Declared reference');
    return Object.freeze({center,systemId:null,pcs:Object.freeze(pcs),label:center===null?'Declared collection':`${glyphs(CLOCK_TONICS[center])} · declared field`,basis:'Declared reference'});
  }
  // Same existing estimator and opening window; this is a display anchor, not a new key detector.
  const end=events.reduce((end,n)=>Math.max(end,Number(n.onset||0)+Number(n.duration||0)),0);
  const candidate=inferScaleCandidates(computePitchClassActivity(events,Math.min(8,end)).raw,{limit:1})[0];
  return candidate?makeClockKey(candidate.rootPc,candidate.systemId,'Opening estimate · editable'):
    Object.freeze({center:null,systemId:null,pcs:Object.freeze([]),label:'Key unresolved',basis:'Choose a song key'});
}

function spellings(key) {
  const labels=Array.from({length:12},(_,pc)=>glyphs(pitchClassName(pc)));
  if(key.center===null||!key.systemId)return labels;
  const system=SCALE_SYSTEMS.find(s=>s.id===key.systemId),letters=['C','D','E','F','G','A','B'];
  const natural=[0,2,4,5,7,9,11],first=letters.indexOf(CLOCK_TONICS[key.center][0]);
  system.intervals.forEach((interval,i)=>{
    const letter=(first+i)%7,pc=(key.center+interval)%12;
    const alteration=((pc-natural[letter]+18)%12)-6;
    labels[pc]=letters[letter]+(alteration>0?'♯'.repeat(alteration):'♭'.repeat(-alteration));
  });
  return labels;
}

function validateKey(key) {
  if(!key||key.center!==null&&!validPc(key.center)||!Array.isArray(key.pcs)||key.pcs.length>12||key.pcs.some(pc=>!validPc(pc))||new Set(key.pcs).size!==key.pcs.length||typeof key.label!=='string'||key.label.length>80||typeof key.basis!=='string'||key.basis.length>100)throw new TypeError('Invalid saved clock key');
  if(key.systemId!==null){const rebuilt=makeClockKey(key.center,key.systemId);if(!sameSet(rebuilt.pcs,key.pcs))throw new TypeError('Saved key does not match its notes');}
  return {...key,pcs:[...key.pcs]};
}

export class NoteClockMemory {
  constructor(events, key) {
    this.events=events;this.originalKey=validateKey(key);this.keys=[{time:0,key:this.originalKey}];this.roles={};this.history=[];
    this.index=Array.from({length:12},()=>({attacks:[],onsets:[],ends:[],spelling:null}));
    for(const event of [...events].sort((a,b)=>a.onset-b.onset)){
      if(event.isRest||!validPc(event.pitchClass)||!Number.isFinite(event.onset)||event.onset<0)continue;
      const row=this.index[event.pitchClass],duration=Math.max(0,Number(event.duration)||0);
      row.onsets.push(event.onset);row.ends.push(Math.max(row.ends.at(-1)||0,event.onset+duration));
      // Octave/voice doubling is one entrance. Ties continue a note, not a new use.
      if(!event.tieStop&&(!row.attacks.length||event.onset-row.attacks.at(-1)>1e-5))row.attacks.push(event.onset);
      if(!row.spelling&&/^[A-G]$/.test(event.step??'')&&Number.isInteger(event.alter??0)&&Math.abs(event.alter??0)<=2)row.spelling=glyphs(noteName(event.step,event.alter));
    }
  }
  at(time) {
    const t=Number.isFinite(time)?Math.max(0,time):0;
    const change=this.keys[upperBound(this.keys.map(x=>x.time),t)-1],key=change.key,labels=spellings(key);
    const notes=this.index.map((row,pc)=>{
      const entrances=upperBound(row.attacks,t),last=entrances?row.attacks[entrances-1]:null;
      const inKey=key.pcs.includes(pc),role=this.roles[pc]??'auto';
      const retained=entrances>0&&(role==='song-color'||role==='auto'&&entrances>=2);
      const kind=inKey?'key':!entrances?'unused':retained?'song-color':'transient';
      const index=upperBound(row.onsets,t)-1,sounding=index>=0&&row.ends[index]>t;
      const flash=kind==='transient'&&last!==null?Math.max(0,1-(t-last)/.7):0;
      return {pc,label:inKey?labels[pc]:row.spelling??labels[pc],inKey,tonic:pc===key.center,kind,entrances,lastOnset:last,sounding,flash,role};
    });
    return {version:NOTE_CLOCK_VERSION,key,keySince:change.time,notes,retained:notes.filter(n=>n.kind==='song-color'),modulationCount:this.keys.length-1};
  }
  remember() {this.history.push(this.settings());if(this.history.length>40)this.history.shift();}
  setKey(key,time=0) {
    validateKey(key);if(!Number.isFinite(time)||time<0)throw new RangeError('Invalid key-change time');
    if(!this.keys.some(x=>Math.abs(x.time-time)<1e-6)&&this.keys.length>=64)throw new RangeError('64 clock key changes reached');
    this.remember();this.keys=this.keys.filter(x=>Math.abs(x.time-time)>=1e-6);this.keys.push({time,key:validateKey(key)});this.keys.sort((a,b)=>a.time-b.time);
  }
  setRole(pc,role) {
    if(!validPc(pc)||!['auto','song-color','transient'].includes(role))throw new TypeError('Choose an automatic, song-color or transient note role');
    this.remember();if(role==='auto')delete this.roles[pc];else this.roles[pc]=role;
  }
  settings() {return {version:NOTE_CLOCK_VERSION,keys:this.keys.map(x=>({time:x.time,key:{...x.key,pcs:[...x.key.pcs]}})),roles:{...this.roles}};}
  restore(settings) {
    if(settings?.version!==NOTE_CLOCK_VERSION||!Array.isArray(settings.keys)||!settings.keys.length||settings.keys.length>64||!settings.roles||Array.isArray(settings.roles)||Object.keys(settings.roles).length>12)throw new TypeError('Unsupported saved clock choices');
    const keys=settings.keys.map((x,i)=>{if(!Number.isFinite(x.time)||x.time<0||!i&&x.time!==0||i&&x.time<=settings.keys[i-1].time)throw new TypeError('Invalid clock key-change timeline');return {time:x.time,key:validateKey(x.key)};});
    for(const [pc,role]of Object.entries(settings.roles))if(!/^(?:[0-9]|1[01])$/.test(pc)||!['song-color','transient'].includes(role))throw new TypeError('Invalid saved note role');
    this.keys=keys;this.roles={...settings.roles};
  }
  reset() {this.remember();this.keys=[{time:0,key:this.originalKey}];this.roles={};}
  undo() {const saved=this.history.pop();if(!saved)return false;this.restore(saved);return true;}
}
