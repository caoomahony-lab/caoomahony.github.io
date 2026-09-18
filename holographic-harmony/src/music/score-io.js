import { parseMusicXML } from "./musicxml.js";
import { parseMidiFile } from "./midi.js";
import { extractMusicXmlFromMxl } from "./mxl.js";
import { serializeParsedScoreToMusicXML } from "./musicxml-export.js";
export const SCORE_IO_VERSION = "score-io-v1";

function extension(name){ const value=String(name||"").toLowerCase(); return value.includes(".")?value.split(".").pop():""; }
export function classifyScoreFile(file){
  if(!file) return "unknown";
  const ext=extension(file.name), type=String(file.type||"").toLowerCase();
  if(ext==="mid"||ext==="midi"||/audio\/midi|audio\/x-midi|application\/x-midi/.test(type)) return "midi";
  if(ext==="mxl"||type.includes("vnd.recordare.musicxml")) return "mxl";
  if(ext==="musicxml"||ext==="xml"||type.includes("xml")) return "musicxml";
  return "unknown";
}
function exportFileName(name){ return String(name||"score").replace(/\.(mxl|musicxml|xml|mid|midi)$/i,"")+".musicxml"; }

export async function prepareLocalScoreFile(file, DOMParserImpl=globalThis.DOMParser, options={}){
  const kind=classifyScoreFile(file), trackId=String(options.trackId||`local:${file?.name||"score"}`);
  if(kind==="musicxml"){
    const xmlText=await file.text();
    const parsed=parseMusicXML(xmlText,DOMParserImpl,{trackId});
    const normalizedXml=serializeParsedScoreToMusicXML({...parsed,sourceFormat:"musicxml",evidenceClass:"measured-from-score"},{title:file.name,sourceFormat:"musicxml",evidenceClass:"measured-from-score"});
    return Object.freeze({version:SCORE_IO_VERSION,sourceFormat:"musicxml",evidenceClass:"measured-from-score",parsed,exportXml:xmlText,normalizedXml,exportFilename:exportFileName(file.name),exportLabel:"Save MusicXML",exportSemantics:"original-musicxml",note:"MusicXML note content is read locally. The original XML is preserved for export; normalized analysis XML is available internally."});
  }
  if(kind==="mxl"){
    const extracted=await extractMusicXmlFromMxl(await file.arrayBuffer());
    const parsed=parseMusicXML(extracted.xmlText,DOMParserImpl,{trackId});
    const normalizedXml=serializeParsedScoreToMusicXML({...parsed,sourceFormat:"mxl",evidenceClass:"measured-from-score"},{title:file.name,sourceFormat:"mxl",evidenceClass:"measured-from-score"});
    return Object.freeze({version:SCORE_IO_VERSION,sourceFormat:"mxl",evidenceClass:"measured-from-score",parsed,exportXml:extracted.xmlText,normalizedXml,exportFilename:exportFileName(file.name),exportLabel:"Extract MusicXML",exportSemantics:"lossless-mxl-root-extraction",rootPath:extracted.rootPath,note:"The MusicXML root document was extracted from MXL locally without uploading the file."});
  }
  if(kind==="midi"){
    const parsed=parseMidiFile(await file.arrayBuffer(),{trackId});
    const exportXml=serializeParsedScoreToMusicXML(parsed,{title:file.name,sourceFormat:"midi",evidenceClass:"encoded-from-midi"});
    return Object.freeze({version:SCORE_IO_VERSION,sourceFormat:"midi",evidenceClass:"encoded-from-midi",parsed,exportXml,normalizedXml:exportXml,exportFilename:exportFileName(file.name),exportLabel:"Export MusicXML",exportSemantics:"generated-from-midi-events",note:"MIDI pitches, timing, velocity, tempo, and meter are encoded event data. MusicXML notation is generated locally and may not reproduce engraving or original voice assignments."});
  }
  throw new Error("Unsupported score file. Choose .musicxml, .xml, .mxl, .mid, or .midi.");
}
