import { PASSAGE_VERSION, comparePassages } from "../analysis/composition-context.js";
export const PASSAGE_LIBRARY_KEY="harmonic-savant:passage-library:v1";
export function readPassageLibrary(storage) {
  if(!storage)throw new Error("Browser storage is unavailable");
  const records=JSON.parse(storage.getItem(PASSAGE_LIBRARY_KEY)||"[]");
  if(!Array.isArray(records)||records.length>64)throw new Error("Unsupported passage library; existing records were preserved");
  for(const record of records){
    if(typeof record?.id!=="string"||record.passage?.version!==PASSAGE_VERSION||typeof record.passage.sourceId!=="string"||typeof record.passage.title!=="string")throw new Error("Unreadable passage record; existing records were preserved");
    comparePassages(record.passage,record.passage);
  }
  return records;
}
export function savePassage(storage,passage) {
  comparePassages(passage,passage);
  const records=readPassageLibrary(storage),id=`${passage.sourceId}:${passage.startIndex}:${passage.endIndex}`;
  const next=records.filter(r=>r.id!==id);
  if(next.length>=64)throw new Error("64 saved passages reached. Export a workspace backup before adding more");
  next.push({id,passage,savedAt:new Date().toISOString()});
  storage.setItem(PASSAGE_LIBRARY_KEY,JSON.stringify(next));return next;
}
