import { analyzePcmChroma } from "./local-audio.js";
self.addEventListener("message",({data})=>{
  try{self.postMessage({result:analyzePcmChroma(data.samples,data.sampleRate,data.options)});}
  catch(error){self.postMessage({error:error.message||String(error)});}
});
