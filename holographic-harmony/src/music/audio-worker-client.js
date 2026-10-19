const aborted=()=>{const error=new Error("Local audio analysis was cancelled");error.name="AbortError";return error;};
export async function analyzePcmOffThread(samples,sampleRate,options={}) {
  const {signal,workerFactory,AudioContextImpl,...analysisOptions}=options;
  if(signal?.aborted)throw aborted();
  if(!workerFactory&&typeof globalThis.Worker!=="function"){
    // Node/CLI compatibility. Browser UI never falls back to a blocking loop.
    const {analyzePcmChroma}=await import("./local-audio.js");if(signal?.aborted)throw aborted();return analyzePcmChroma(samples,sampleRate,analysisOptions);
  }
  const worker=workerFactory?workerFactory():new Worker(new URL("./audio-analysis-worker.js",import.meta.url),{type:"module"});
  return new Promise((resolve,reject)=>{
    let finished=false;
    const finish=(value,error)=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener("abort",cancel);worker.terminate();if(error)reject(error);else resolve(value);};
    const cancel=()=>finish(null,aborted());
    const timer=setTimeout(()=>finish(null,new Error("Local PCM analysis exceeded its120-second budget")),120000);
    worker.addEventListener("message",({data})=>data.error?finish(null,new Error(data.error)):finish(data.result));
    worker.addEventListener("error",event=>finish(null,new Error(event.message||"Audio analysis worker failed")));
    signal?.addEventListener("abort",cancel,{once:true});
    if(signal?.aborted){cancel();return;}
    try{worker.postMessage({samples,sampleRate,options:analysisOptions},[samples.buffer]);}catch(error){finish(null,error);}
  });
}
