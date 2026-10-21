import test from 'node:test';import assert from 'node:assert/strict';
import {HolographicHarmonyApp} from '../src/app/app.js';
import {CollectionAwareHolographicHarmonyApp} from '../src/app/collection-aware-app.js';
import {validatePartition} from '../src/theory/fields.js';
const field=[1,3,4,6,8,10,11];
test('adaptive local candidates cannot change the default clock key; legacy field view remains available',()=>{
 const previous=globalThis.document;globalThis.document={createElement:()=>({style:{},appendChild(){},append(){}})};
 const notes=[{onset:0,duration:.2,pitchClass:9},{onset:5,duration:.2,pitchClass:9}];let rendered;
 const app={currentTrack:{id:'test',analysis:{mode:'adaptive',field:{center:11,pcs:field}}},generation:1,notes,activeField:[...field],audio:{duration:20},lastRenderTime:-1,
 noteClockControls:{view:{value:'memory'},attach(){},update(){}},noteClockAt:HolographicHarmonyApp.prototype.noteClockAt,
 pitchCircle:{update(value){rendered=value;}},fieldEl:{},activeEl:{},shadowEl:{},admissionsEl:{},orderEl:{},candidatesEl:{appendChild(){}},crystallizationEl:{},
 primaryDiagnosticLabel:{},timeEl:{},seek:{},timeline:{update(){}},root:{dispatchEvent(){}},renderHarmonicAt(){}};
 try{
  CollectionAwareHolographicHarmonyApp.prototype.renderAt.call(app,6,true);
  assert.deepEqual(app.activeField,field);assert.equal(rendered.clock.notes[9].kind,'song-color');assert.equal(rendered.clock.key.center,11);assert.equal(validatePartition(app.activeField,app.shadowField).valid,true);
  app.noteClockControls.view.value='legacy';CollectionAwareHolographicHarmonyApp.prototype.renderAt.call(app,6,true);
  assert.equal(rendered.clock,null);assert.notDeepEqual(app.activeField,field);assert.equal(validatePartition(app.activeField,app.shadowField).valid,true);
 }finally{globalThis.document=previous;}
});
