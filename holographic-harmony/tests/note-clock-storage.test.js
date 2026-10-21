import test from 'node:test';import assert from 'node:assert/strict';
import {NoteClockMemory,makeClockKey} from '../src/visualization/note-clock-state.js';
import {readClockChoices,saveClockChoices} from '../src/app/note-clock-controls.js';
const storage=()=>({data:new Map(),getItem(k){return this.data.get(k)??null;},setItem(k,v){this.data.set(k,v);}});
test('source-specific clock choices survive a round trip without leaking to another composition',()=>{
 const s=storage(),m=new NoteClockMemory([],makeClockKey(11,'major'));m.setRole(9,'song-color');m.setKey(makeClockKey(0,'major'),12);saveClockChoices(s,'source:a',m.settings());
 const restored=new NoteClockMemory([],makeClockKey(6,'major'));restored.restore(readClockChoices(s,'source:a'));
 assert.equal(restored.at(1).key.center,11);assert.equal(restored.at(13).key.center,0);assert.equal(restored.roles[9],'song-color');assert.equal(readClockChoices(s,'source:b'),null);
});
test('corrupt or unfamiliar saved records are preserved instead of rewritten',()=>{
 for(const raw of ['{broken',JSON.stringify({version:2,records:[]}),JSON.stringify({version:1,records:[{sourceId:'other',settings:{version:'future-schema'}}]})]){
  const s=storage();s.setItem('harmonic-savant:note-clock-choices:v1',raw);
  assert.throws(()=>saveClockChoices(s,'source:a',new NoteClockMemory([],makeClockKey(11,'major')).settings()));assert.equal(s.data.values().next().value,raw);
 }
});
test('a failed clock save reports failure and leaves previously saved bytes intact',()=>{
 const s=storage(),m=new NoteClockMemory([],makeClockKey(11,'major'));saveClockChoices(s,'source:a',m.settings());const before=s.data.values().next().value;
 s.setItem=()=>{throw new Error('Quota exceeded');};m.setRole(9,'song-color');assert.throws(()=>saveClockChoices(s,'source:a',m.settings()),/Quota/);assert.equal(s.data.values().next().value,before);
});
test('invalid modulation order or key-note mismatch is rejected before replacing saved choices',()=>{
 const m=new NoteClockMemory([],makeClockKey(11,'major'));const bad=m.settings();bad.keys[0].key.pcs=[0,1,2];assert.throws(()=>m.restore(bad));assert.equal(m.at(0).key.center,11);
});
