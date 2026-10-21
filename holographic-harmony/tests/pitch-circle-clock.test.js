import test from 'node:test';import assert from 'node:assert/strict';
import { PitchCircle } from '../src/visualization/pitch-circle.js';
class Element {constructor(){this.attrs={};this.children=[];this.classes=new Set();this.classList={add:(...xs)=>xs.forEach(x=>this.classes.add(x)),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x)};this.style={setProperty(){}};}setAttribute(k,v){this.attrs[k]=String(v);}append(...xs){this.children.push(...xs);}appendChild(x){this.append(x);}addEventListener(){} }
test('clock retains a recurring outside note and red tonic without replacing them with a transient white fill',()=>{
 const saved=globalThis.document;globalThis.document={createElementNS:()=>new Element()};try{
  const circle=new PitchCircle(new Element());const notes=Array.from({length:12},(_,pc)=>({pc,label:String(pc),inKey:pc===11,tonic:pc===11,kind:pc===11?'key':pc===9?'song-color':'unused',entrances:pc===9?2:0,sounding:false,flash:0}));
  circle.update({activeField:[11],activity:{normalized:Array(12).fill(0)},events:[],timeSeconds:20,fieldLabel:'B Major',clock:{key:{label:'B Major',center:11,basis:'declared'},notes}});
  assert.equal(circle.nodes[9].group.classes.has('is-song-color'),true);assert.equal(circle.nodes[11].group.classes.has('is-tonic'),true);
  assert.equal(circle.nodes[9].circle.style.fill,'#9b681f');assert.equal(circle.nodes[11].circle.style.fill,'#6b2035');
 }finally{globalThis.document=saved;}
});
