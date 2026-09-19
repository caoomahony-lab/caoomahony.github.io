export const MUSICXML_EXPORT_VERSION = "musicxml-export-v1";
export const MUSICXML_EXPORT_DIVISIONS = 960;

function escapeXml(value) {
  return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;");
}
function mod12(value) { return ((Number(value) % 12) + 12) % 12; }
function pitchFromMidi(midi) {
  const map=[["C",0],["C",1],["D",0],["D",1],["E",0],["F",0],["F",1],["G",0],["G",1],["A",0],["A",1],["B",0]];
  const [step,alter]=map[mod12(midi)];
  return { step, alter, octave: Math.floor(Number(midi)/12)-1 };
}
function pitchOf(note) {
  if (note?.step && Number.isFinite(Number(note?.octave))) return { step:String(note.step).toUpperCase(), alter:Number(note.alter||0), octave:Number(note.octave) };
  return pitchFromMidi(Number(note.midi));
}
function normalizeTimeSignatures(events=[]) {
  const sorted=[...events].filter(e=>Number.isFinite(Number(e?.qBeat))&&Number(e?.beats)>0&&Number(e?.beatType)>0)
    .map(e=>({qBeat:Math.max(0,Number(e.qBeat)),beats:Math.max(1,Math.round(Number(e.beats))),beatType:Math.max(1,Math.round(Number(e.beatType))) }))
    .sort((a,b)=>a.qBeat-b.qBeat);
  if(!sorted.length||sorted[0].qBeat>0) sorted.unshift({qBeat:0,beats:4,beatType:4});
  const out=[]; for(const e of sorted){ if(out.length&&Math.abs(out.at(-1).qBeat-e.qBeat)<1e-9) out[out.length-1]=e; else out.push(e); } return out;
}
function signatureAt(q, sigs){ let out=sigs[0]; for(const s of sigs){ if(s.qBeat>q+1e-9) break; out=s; } return out; }
function buildGrid(durationQ, events) {
  const sigs=normalizeTimeSignatures(events); const measures=[]; let cursor=0; let index=1; const target=Math.max(durationQ,0.001);
  while(cursor<target-1e-9){
    const sig=signatureAt(cursor,sigs); const nominal=sig.beats*(4/sig.beatType);
    const nextSig=sigs.find(e=>e.qBeat>cursor+1e-9); let end=cursor+nominal;
    if(nextSig&&nextSig.qBeat<end-1e-9) end=nextSig.qBeat;
    measures.push({measureIndex:index,measureNumber:String(index),startQ:cursor,endQ:end,beats:sig.beats,beatType:sig.beatType});
    cursor=end; index++; if(index>100000) throw new Error("MusicXML measure grid exceeded safety bound");
  }
  return measures;
}
function measureMapForPart(parsed, partIndex, durationQ) {
  const source=(parsed.measureMap||[]).filter(m=>Number(m.partIndex)===Number(partIndex))
    .map(m=>({measureIndex:Number(m.measureIndex),measureNumber:String(m.measureNumber??m.measureIndex),startQ:Number(m.startQ),endQ:Number(m.endQ),beats:Number(m.beats||4),beatType:Number(m.beatType||4)}))
    .filter(m=>Number.isFinite(m.startQ)&&Number.isFinite(m.endQ)&&m.endQ>m.startQ).sort((a,b)=>a.startQ-b.startQ);
  return source.length?source:buildGrid(durationQ,parsed.timeSignatureEvents);
}
function splitAcrossMeasures(note, measures) {
  const start=Number(note.qBeat||0), end=start+Math.max(0,Number(note.durationQ||0));
  if(end<=start+1e-12){
    const measure=measures.find(m=>start>=m.startQ-1e-9&&start<m.endQ+1e-9)||measures[0];
    return [{...note,qBeat:start,durationQ:0,measure,splitTieStart:false,splitTieStop:false}];
  }
  const pieces=[];
  for(const measure of measures){
    const a=Math.max(start,measure.startQ), b=Math.min(end,measure.endQ);
    if(b<=a+1e-9) continue;
    pieces.push({...note,qBeat:a,durationQ:b-a,measure,splitTieStop:a>start+1e-9||Boolean(note.tieStop),splitTieStart:b<end-1e-9||Boolean(note.tieStart)});
  }
  return pieces;
}
function assignLanes(notes) {
  const groups=new Map();
  for(const note of notes){ const key=Number(note.qBeat).toFixed(9); const g=groups.get(key)||[]; g.push(note); groups.set(key,g); }
  const onsetGroups=[...groups.values()].map(g=>g.sort((a,b)=>Number(b.durationQ)-Number(a.durationQ)||Number(a.midi)-Number(b.midi))).sort((a,b)=>Number(a[0].qBeat)-Number(b[0].qBeat));
  const lanes=[];
  for(const group of onsetGroups){
    const onset=Number(group[0].qBeat), end=Math.max(...group.map(n=>onset+Number(n.durationQ)));
    let lane=lanes.find(x=>onset>=x.endQ-1e-9); if(!lane){ lane={endQ:-Infinity,groups:[]}; lanes.push(lane); }
    lane.groups.push(group); lane.endQ=Math.max(lane.endQ,end);
  }
  return lanes;
}
function divs(q){ return Math.max(0,Math.round(Number(q)*MUSICXML_EXPORT_DIVISIONS)); }
function noteXml(note,{chord=false,voice=1}={}) {
  const p=pitchOf(note), duration=divs(note.durationQ), grace=duration===0||note.isGrace;
  const tieStop=Boolean(note.splitTieStop), tieStart=Boolean(note.splitTieStart);
  const notation=(tieStop||tieStart)?`<notations>${tieStop?'<tied type="stop"/>':''}${tieStart?'<tied type="start"/>':''}</notations>`:"";
  return ["<note>",chord?"<chord/>":"",grace?"<grace/>":"","<pitch>",`<step>${escapeXml(p.step)}</step>`,p.alter?`<alter>${p.alter}</alter>`:"",`<octave>${p.octave}</octave>`,"</pitch>",grace?"":`<duration>${duration}</duration>`,`<voice>${voice}</voice>`,`<staff>${Math.max(1,Number(note.staff||1))}</staff>`,tieStop?'<tie type="stop"/>':"",tieStart?'<tie type="start"/>':"",notation,"</note>"].join("");
}
function tempoXml(event,startQ){
  const offset=divs(Number(event.qBeat)-startQ), bpm=Math.round(Number(event.bpm)*1000)/1000;
  return ["<direction placement=\"above\">","<direction-type><metronome><beat-unit>quarter</beat-unit>",`<per-minute>${bpm}</per-minute></metronome></direction-type>`,offset>0?`<offset>${offset}</offset>`:"",`<sound tempo="${bpm}"/>`,"</direction>"].join("");
}
function writeMeasure(measure,notes,tempos,signatureChanged){
  const duration=divs(measure.endQ-measure.startQ);
  const attributes=["<attributes>",`<divisions>${MUSICXML_EXPORT_DIVISIONS}</divisions>`,signatureChanged?`<time><beats>${measure.beats}</beats><beat-type>${measure.beatType}</beat-type></time>`:"","<staves>1</staves>","</attributes>"].join("");
  const directions=tempos.filter(e=>Number(e.qBeat)>=measure.startQ-1e-9&&Number(e.qBeat)<measure.endQ-1e-9).map(e=>tempoXml(e,measure.startQ)).join("");
  const laneXml=[]; const lanes=assignLanes(notes);
  lanes.forEach((lane,laneIndex)=>{
    if(laneIndex>0) laneXml.push(`<backup><duration>${duration}</duration></backup>`);
    let cursor=measure.startQ;
    for(const group of lane.groups){
      const onset=Number(group[0].qBeat);
      if(onset>cursor+1e-9){ laneXml.push(`<forward><duration>${divs(onset-cursor)}</duration></forward>`); cursor=onset; }
      group.forEach((note,index)=>laneXml.push(noteXml(note,{chord:index>0,voice:laneIndex+1})));
      cursor=Math.max(cursor,...group.map(note=>onset+Number(note.durationQ)));
    }
  });
  return [`<measure number="${escapeXml(measure.measureNumber)}">`,attributes,directions,laneXml.join(""),"</measure>"].join("");
}

export function serializeParsedScoreToMusicXML(parsed, options={}) {
  if(!parsed||!Array.isArray(parsed.notes)) throw new TypeError("parsed score with notes is required");
  const title=String(options.title||"Harmonic Savant Score"), evidenceClass=String(options.evidenceClass||parsed.evidenceClass||"encoded-score-data"), sourceFormat=String(options.sourceFormat||parsed.sourceFormat||"musicxml");
  const durationQ=Math.max(Number(parsed.durationQuarterBeats||0),...parsed.notes.map(n=>Number(n.qBeat||0)+Number(n.durationQ||0)),0);
  const tempos=Array.isArray(parsed.tempoEvents)?parsed.tempoEvents:[{qBeat:0,bpm:120}];
  const partIndices=[...new Set(parsed.notes.map(n=>Number(n.partIndex??0)))].sort((a,b)=>a-b); if(!partIndices.length) partIndices.push(0);
  const partIds=new Map(partIndices.map((partIndex,index)=>[partIndex,String(parsed.notes.find(n=>Number(n.partIndex??0)===partIndex)?.partId||`P${index+1}`)]));
  const partList=partIndices.map((partIndex,index)=>`<score-part id="${escapeXml(partIds.get(partIndex))}"><part-name>${escapeXml(parsed.trackNames?.[partIndex]||`Part ${index+1}`)}</part-name></score-part>`).join("");
  const partsXml=partIndices.map(partIndex=>{
    const measures=measureMapForPart(parsed,partIndex,durationQ), partNotes=parsed.notes.filter(n=>Number(n.partIndex??0)===partIndex), split=partNotes.flatMap(n=>splitAcrossMeasures(n,measures));
    let previousSignature=null;
    const measuresXml=measures.map((measure,index)=>{
      const key=`${measure.beats}/${measure.beatType}`, changed=index===0||key!==previousSignature; previousSignature=key;
      return writeMeasure(measure,split.filter(n=>n.measure===measure),tempos,changed);
    }).join("");
    return `<part id="${escapeXml(partIds.get(partIndex))}">${measuresXml}</part>`;
  }).join("");
  const metadata=["<identification><encoding>","<software>Harmonic Savant</software>",`<encoding-description>${MUSICXML_EXPORT_VERSION}</encoding-description>`,"</encoding><miscellaneous>",`<miscellaneous-field name="harmonic-savant-source-format">${escapeXml(sourceFormat)}</miscellaneous-field>`,`<miscellaneous-field name="harmonic-savant-evidence">${escapeXml(evidenceClass)}</miscellaneous-field>`,"</miscellaneous></identification>"].join("");
  return ['<?xml version="1.0" encoding="UTF-8"?>','<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">','<score-partwise version="4.0">',`<work><work-title>${escapeXml(title)}</work-title></work>`,metadata,`<part-list>${partList}</part-list>`,partsXml,"</score-partwise>"].join("\n");
}
