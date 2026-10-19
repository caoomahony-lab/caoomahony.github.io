import test from 'node:test';
import assert from 'node:assert/strict';
import { HolographicHarmonyApp } from '../src/app/app.js';
function app(){ const a={generation:4,currentTrack:{id:'old',title:'Old',audio:'blob:old'},notes:[{midi:60}],duration:8,activeField:[0,4,7],shadowField:[1,2,3,5,6,8,9,10,11],localObjectUrl:'blob:old',audio:{src:'blob:old',currentTime:3,load(){},pause(){},addEventListener(){}},status:{textContent:'READY'},sourceNote:{textContent:'Old source'},modeBadge:{textContent:'score'},playButton:{disabled:false},trackSelect:{},exportMusicXmlButton:{},converterStatus:{},root:{dispatchEvent(){}},renderAt(t){this.lastRenderTime=t;},captureLoadSession:HolographicHarmonyApp.prototype.captureLoadSession}; return a;}
test('failed parsed import restores prior valid notes, playback source and exports',()=>{
 const a=app(); a.loadSession=a.captureLoadSession(); const old=a.notes; a.currentTrack=null;a.notes=[];a.audio.src='';a.duration=0;
 assert.equal(HolographicHarmonyApp.prototype.recoverLoadFailure.call(a,new Error('invalid XML'),4),true);
 assert.equal(a.notes,old);assert.equal(a.audio.src,'blob:old');assert.equal(a.lastRenderTime,3);assert.equal(a.currentTrack.title,'Old');assert.match(a.sourceNote.textContent,/invalid XML.*previous song/i);assert.equal(a.playButton.disabled,false);
});
test('late import failure never rolls a newer valid source backward',()=>{const a=app();a.loadSession=a.captureLoadSession();a.generation=5;a.currentTrack={title:'New'};assert.equal(HolographicHarmonyApp.prototype.recoverLoadFailure.call(a,new Error('late'),4),false);assert.equal(a.currentTrack.title,'New');});
test('a new source clears the old rendered clock before publishing its first interval',()=>{const a=app();a.lastRenderTime=4;a.stopAnimation=()=>{};a.abortController=null;a.clearScoreExport=()=>{};a.resetDiagnostics=()=>{};HolographicHarmonyApp.prototype.beginLoad.call(a);assert.equal(a.lastRenderTime,-1);assert.equal(a.currentTrack,null);assert.equal(a.loadSession.time,4);});
