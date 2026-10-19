import test from 'node:test';import assert from 'node:assert/strict';
import { HarmonicSavantApp } from '../src/app/harmonic-savant-app.js';
test('overlapping failed loads retain the original recoverable panels, not the intermediate empty state',()=>{
 const track={id:'original'},analysis={hir:'original'},current={title:'Original'},evidence={sourceId:'old'};
 const app={visualizer:{loadSession:{state:{currentTrack:track}}},scoreExplorer:{current,analysis,audioTitle:null,invalidate(){this.current=null;this.analysis=null;}},explorer:{current:null,render(){}},continuation:{invalidate(){}},explorerRoot:{},scoreExplorerRoot:{},sourceEvidence:evidence};
 HarmonicSavantApp.prototype.handleSourceLoading.call(app);HarmonicSavantApp.prototype.handleSourceLoading.call(app);
 assert.equal(app.panelRecovery.current,current);assert.equal(app.panelRecovery.analysis,analysis);assert.equal(app.panelRecovery.evidence,evidence);
});
