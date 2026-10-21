import test from 'node:test';
import assert from 'node:assert/strict';
import { NoteClockMemory, makeClockKey } from '../src/visualization/note-clock-state.js';
const key=makeClockKey(11,'major');
const note=(pc,onset,duration=.2,extra={})=>({pitchClass:pc,onset,duration,...extra});
test('recurring A is retained after the flash and long gaps without changing B major',()=>{
 const clock=new NoteClockMemory([note(9,1),note(9,5),note(4,12)],key);
 assert.equal(clock.at(1.1).notes[9].kind,'transient');
 const late=clock.at(60);assert.equal(late.notes[9].kind,'song-color');assert.equal(late.notes[9].entrances,2);
 assert.deepEqual(late.key.pcs,[1,3,4,6,8,10,11]);assert.equal(late.key.center,11);assert.equal(late.notes[9].inKey,false);
});
test('single incidental tone fades; octave doubling and ties do not manufacture recurrence',()=>{
 const clock=new NoteClockMemory([note(9,1),note(9,1,1,{midi:81}),note(9,2,.5,{tieStop:true})],key);
 assert.ok(clock.at(1.1).notes[9].flash>0);assert.equal(clock.at(10).notes[9].flash,0);
 assert.equal(clock.at(10).notes[9].kind,'transient');assert.equal(clock.at(10).notes[9].entrances,1);
});
test('backward seeking replays musical history and cannot retain an unheard future color',()=>{
 const clock=new NoteClockMemory([note(9,1),note(9,5)],key);
 assert.equal(clock.at(7).notes[9].kind,'song-color');assert.equal(clock.at(2).notes[9].kind,'transient');assert.equal(clock.at(0).notes[9].kind,'unused');
});
test('key membership and sounding activity are separate, with half-open note ends',()=>{
 const clock=new NoteClockMemory([note(11,1,2),note(9,2,3)],key);
 assert.equal(clock.at(2).notes[11].inKey,true);assert.equal(clock.at(2).notes[11].sounding,true);
 assert.equal(clock.at(3).notes[11].sounding,false);assert.equal(clock.at(3).key.center,11);
});
test('a confirmed modulation is time-local, reversible and does not erase earlier song colors',()=>{
 const clock=new NoteClockMemory([note(9,1),note(9,5)],key);clock.setKey(makeClockKey(0,'major'),10);
 assert.equal(clock.at(9).key.center,11);assert.equal(clock.at(11).key.center,0);assert.equal(clock.at(11).notes[9].inKey,true);
 assert.equal(clock.undo(),true);assert.equal(clock.at(11).key.center,11);assert.equal(clock.at(11).notes[9].kind,'song-color');
});
test('intentional one-off color or excluded mistake is a reversible user interpretation, not changed evidence',()=>{
 const events=[note(9,1),note(9,5)];const before=structuredClone(events);const clock=new NoteClockMemory(events,key);
 clock.setRole(9,'song-color');assert.equal(clock.at(2).notes[9].kind,'song-color');clock.setRole(9,'transient');
 assert.equal(clock.at(6).notes[9].kind,'transient');assert.equal(clock.undo(),true);assert.equal(clock.at(6).notes[9].kind,'song-color');
 assert.deepEqual(events,before);assert.equal(new NoteClockMemory([],key).at(6).notes[9].kind,'unused');
});
test('labels follow the chosen seven-note key, including E sharp in F sharp major',()=>{
 const clock=new NoteClockMemory([],makeClockKey(6,'major'));assert.equal(clock.at(0).notes[5].label,'E♯');
 assert.equal(clock.at(0).notes[6].tonic,true);assert.throws(()=>makeClockKey(12,'major'));assert.throws(()=>clock.setRole(9,'wrongly-guessed'));
});
test('strong chromatic or new-key material cannot silently override the chosen reference',()=>{
 const events=Array.from({length:60},(_,i)=>note([0,2,4,5,7,9,11][i%7],i));const clock=new NoteClockMemory(events,key);
 for(const t of [0,5,20,59,120])assert.deepEqual(clock.at(t).key.pcs,key.pcs);
});
test('song-color memory does not redefine the canonical recent-admission persistence rule',async()=>{
 const {computeAdmissionHistory}=await import('../src/theory/admissions.js');const events=[note(9,1),note(9,5)];
 const canonical=computeAdmissionHistory(events,[0,2,5,7,9],60);assert.equal(canonical.ordered[0].persistent,false);
 assert.equal(new NoteClockMemory(events,key).at(60).notes[9].kind,'song-color');
});
