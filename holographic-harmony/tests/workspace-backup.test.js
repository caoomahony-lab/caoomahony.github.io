import test from 'node:test';
import assert from 'node:assert/strict';
import { exportWorkspace, restoreWorkspace } from '../src/model/workspace-backup.js';
function storage(values={}) { const data=new Map(Object.entries(values)); return {data,get length(){return data.size;},key(i){return [...data.keys()][i]??null;},getItem(k){return data.get(k)??null;},setItem(k,v){data.set(k,String(v));},removeItem(k){data.delete(k);}}; }
test('workspace backup round trip preserves unfamiliar and corrupt app records as exact bytes',()=>{
 const a=storage({'harmonic-savant:future:v9':'{"unknown":true}','harmonic-savant:score-library:v1':'broken JSON','unrelated':'private'});
 const backup=exportWorkspace(a); assert.equal(backup.records.length,2); const b=storage();
 assert.equal(restoreWorkspace(b,backup).restored,2); assert.equal(b.getItem('harmonic-savant:score-library:v1'),'broken JSON'); assert.equal(b.getItem('unrelated'),null);
});
test('restoration never replaces an existing different record or removes unrelated work',()=>{
 const a=storage({'harmonic-savant:a':'old','unrelated':'keep'}); const backup={version:'harmonic-workspace-backup-v1',records:[{key:'harmonic-savant:a',value:'new'},{key:'harmonic-savant:b',value:'new'}]};
 assert.throws(()=>restoreWorkspace(a,backup),/conflict/i); assert.equal(a.getItem('harmonic-savant:b'),null); assert.equal(a.getItem('unrelated'),'keep');
});
test('failed restoration rolls back every new key and reports quota failure',()=>{
 const a=storage(); const set=a.setItem.bind(a); a.setItem=(k,v)=>{if(k.endsWith(':b'))throw new Error('quota');set(k,v);};
 assert.throws(()=>restoreWorkspace(a,{version:'harmonic-workspace-backup-v1',records:[{key:'harmonic-savant:a',value:'1'},{key:'harmonic-savant:b',value:'2'}]}),/quota/); assert.equal(a.data.size,0);
});
test('backup rejects duplicate, foreign, truncated and oversized input before writes',()=>{
 const a=storage(); for(const records of [[{key:'foreign',value:'x'}],[{key:'harmonic-savant:a',value:1}],[{key:'harmonic-savant:a',value:'1'},{key:'harmonic-savant:a',value:'2'}]])assert.throws(()=>restoreWorkspace(a,{version:'harmonic-workspace-backup-v1',records}));
 assert.equal(a.data.size,0); assert.throws(()=>restoreWorkspace(a,'{"truncated":'));
});
