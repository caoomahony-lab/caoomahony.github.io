export function generatedAuditionVoicing(candidate,preferred=null,{midiRange=[48,84]}={}) {
  if(!Array.isArray(midiRange)||midiRange.length!==2||!midiRange.every(Number.isInteger)||midiRange[0]<0||midiRange[1]>127||midiRange[0]>midiRange[1])throw new RangeError("Invalid audition register");
  if(preferred?.length){if(preferred.length>6||preferred.some(n=>!Number.isInteger(n)||n<midiRange[0]||n>midiRange[1]))throw new Error("Generated voicing exceeds declared register or voice budget");return [...preferred];}
  const pcs=candidate?.pitchClasses;
  if(!Array.isArray(pcs)||!pcs.length||pcs.length>6)throw new Error("Audition requires 1–6 generated pitch classes");
  return [...new Set(pcs)].map(pc=>{const notes=[];for(let n=midiRange[0];n<=midiRange[1];n++)if(n%12===pc)notes.push(n);if(!notes.length)throw new Error("No legal note in declared register");return notes.sort((a,b)=>Math.abs(a-60)-Math.abs(b-60)||a-b)[0];}).sort((a,b)=>a-b);
}
export class ChordAudition {
  stop(){clearTimeout(this.timer);const context=this.context;this.context=null;for(const node of this.nodes||[])try{node.stop();}catch{}this.nodes=[];if(context)context.close().catch(()=>{});}
  async play(notes,{seconds=1,onStart=()=>{}}={}) {
    if(!Array.isArray(notes)||!notes.length||notes.length>6||notes.some(n=>!Number.isInteger(n)||n<0||n>127))throw new TypeError("Audition requires bounded MIDI notes");
    this.stop();onStart();const Impl=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Impl)throw new Error("Audio synthesis unavailable in this browser");
    const ctx=new Impl();this.context=ctx;this.nodes=[];
    try{await ctx.resume();if(this.context!==ctx)return;const t=ctx.currentTime,end=t+Math.min(4,Math.max(0.2,seconds));
      for(const midi of notes){const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type="sine";oscillator.frequency.value=440*2**((midi-69)/12);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(0.07/notes.length,t+0.02);gain.gain.setValueAtTime(0.07/notes.length,end-0.08);gain.gain.linearRampToValueAtTime(0,end);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(t);oscillator.stop(end);this.nodes.push(oscillator);}
      clearTimeout(this.timer);this.timer=setTimeout(()=>{if(this.context===ctx)this.stop();},(end-t)*1000+100);
    }catch(error){this.stop();throw error;}
  }
}
