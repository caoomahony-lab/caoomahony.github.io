import { createPassage, COMPOSITION_CONTEXT_VERSION } from "./composition-context.js";
export function compositionReport(song,startIndex,endIndex,{context=null,session=null,searchResults=[],events=[]}={}) {
  const passage=createPassage(song,startIndex,endIndex);
  if(context&&(context.sourceId!==song.sourceId||context.selectedIndex!==endIndex||context.startIndex!==startIndex))throw new Error("Analysis interval is stale; analyze the selected passage before exporting");
  return {version:"composition-report-v1",engineVersion:COMPOSITION_CONTEXT_VERSION,source:{id:song.sourceId,title:song.title,evidenceClass:song.evidenceClass},
    passage,context,interpretations:session?.progression??null,
    continuations:session?.composition?{intention:session.composition.intention,definition:session.composition.definition,weights:session.composition.weights,
      candidates:session.composition.ranking.slice(0,6).map(({candidate,...rest})=>rest)}:null,
    comparisons:searchResults,events:events.filter(e=>e.onsetSec<passage.end&&e.endSec>passage.onset),
    limitations:["Experimental composition heuristics, not validated musical preference or emotional prediction.","Sequence search uses equal region counts and one global transposition; no inferred matching passages from summary-only references.","Functional target-key translation preserves inferred root/template relations; slash bass, register, performance and original notation are not rewritten by this view.","Text/CSV/Markdown exports project analysis; they are not performance or notation round trips."]};
}
const csvCell=value=>{let s=String(value??"");if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
export function compositionCSV(report) {
  const rows=[["sourceId","region","onsetSeconds","endSeconds","chordInterpretation","pitchClasses","evidence"]];
  report.passage.regions.forEach((r,i)=>rows.push([report.source.id,report.passage.startIndex+i+1,r.onset,r.end,r.symbol,r.pcs.join(" "),report.source.evidenceClass]));
  return rows.map(row=>row.map(csvCell).join(",")).join("\r\n");
}
export function compositionMarkdown(report) {
  const p=report.passage,lines=["# Composition laboratory report","",`Source: ${report.source.title}`,`Source identity: ${report.source.id}`,`Evidence: ${report.source.evidenceClass}`,`Passage: chords ${p.startIndex+1}–${p.endIndex+1}; ${p.onset.toFixed(3)}–${p.end.toFixed(3)} seconds`,""];
  if(report.context)lines.push(`Context: ${report.context.mode}. ${report.context.scope}`,"");
  lines.push("Progression: "+p.regions.map(r=>r.symbol||"unresolved").join(" → "),"");
  if(report.interpretations)lines.push("Functional translation: "+report.interpretations.map(r=>`${r.sourceSymbol}: ${r.function?.roman||"ambiguous"}${r.function?.targetKeyChord?" → "+r.function.targetKeyChord:""}`).join("; "),"");
  if(report.continuations){lines.push(`Intention: ${report.continuations.intention}`,report.continuations.definition,"");for(const c of report.continuations.candidates)lines.push(`- ${c.symbol}: objective index ${(c.score*100).toFixed(1)}/100; hypothetical.`);}
  for(const c of report.comparisons)lines.push(`- Passage match ${c.title}, chords ${c.startIndex+1}–${c.endIndex+1}: ordered pitch-set distance ${c.comparison.pitchSetDistance.toFixed(3)}; shift +${c.comparison.shiftBToA}.`);
  lines.push("","Limitations:",...report.limitations.map(x=>"- "+x));return lines.join("\n");
}
