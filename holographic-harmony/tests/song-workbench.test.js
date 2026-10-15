import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseMusicXML } from "../src/music/musicxml.js";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { inferScoreHarmony } from "../src/inference/score-harmony.js";
import { createSongProgression, progressionThroughSelection, regionIndexAt } from "../src/model/song-progression.js";
import { parseChordSymbol } from "../src/input/chord-symbols.js";
import { CHORD_TEMPLATES, chordSymbol } from "../src/theory/chords.js";
import { analyzeWorkbench, orderedContinuations, processWorkbenchRequest } from "../src/continuation/workbench-service.js";
import { matchProgressionReferences, sharedProgressionDevices } from "../src/catalog/progression-references.js";
import { FEELING_NOTES_KEY, readFeelingNotes, saveFeelingNote } from "../src/model/feeling-notes.js";
import { SongContinuationPanel } from "../src/app/song-continuation-panel.js";
import { HarmonicSavantApp } from "../src/app/harmonic-savant-app.js";
import { scoreCorpusContinuation, scoreStyleContinuation } from "../src/continuation/scores/evidence-score.js";
import { FingerprintExplorer } from "../src/app/fingerprint-explorer.js";
import { CollectionAwareHolographicHarmonyApp } from "../src/app/collection-aware-app.js";

const parsed = parseMusicXML(fs.readFileSync(new URL("../public/tracks/chromatic-voice-leading.musicxml", import.meta.url), "utf8"), LiteDOMParser);
const song = createSongProgression({ scoreHarmony: inferScoreHarmony(parsed.notes), sourceId: "demo:chromatic", title: "Chromatic", generation: 1 });
const regions = symbols => symbols.map((symbol, index) => ({ ...parseChordSymbol(symbol), symbol, onset: index * 2, end: index * 2 + 2 }));
const memory = () => { const data = new Map(); return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) }; };

test("song progression reuses measured score regions and does not include future chords", () => {
  assert.equal(song.regions.length, 8);
  assert.equal(song.evidenceClass, "measured-notes-inferred-chords");
  assert.equal(progressionThroughSelection(song, 1).progression, "F# | D#m/F#");
  assert.equal(song.regions[2].symbol, "A#/F");
  assert.ok(Object.isFrozen(song.regions[0].candidates));
});
test("region selection respects rests, exact boundaries and optional final endpoint", () => {
  const items = [{ onset: 1, end: 2 }, { onset: 3, end: 4 }];
  for (const time of [-1, 0, 2, 2.9, 4, NaN]) assert.equal(regionIndexAt(items, time), -1);
  assert.equal(regionIndexAt(items, 1), 0); assert.equal(regionIndexAt(items, 3), 1);
  assert.equal(regionIndexAt(items, 4, { includeFinalEndpoint: true }), 1);
});
test("audio frame rounding cannot send a selected chord back to the previous region", () => {
  // Actual 11,025-Hz analysis boundaries after decoding the bundled fixture.
  const boundaries = [
    [0, 1.9504761904761905], [1.9504761904761905, 3.900952380952381],
    [3.900952380952381, 5.851428571428571], [5.851428571428571, 7.801904761904762],
    [7.801904761904762, 10.031020408163267], [10.031020408163265, 11.981496598639456],
    [11.981496598639456, 13.931972789115648], [13.931972789115646, 15.882448979591837]
  ];
  const items = boundaries.map(([onset, end]) => ({ onset, end }));
  for (let index = 0; index < items.length; index++) assert.equal(regionIndexAt(items, items[index].onset), index);
  const panel = { song: { regions: items, generation: 9 }, selectedIndex: 7, sourceMode: { value: "song" },
    follow: { checked: true }, select() { assert.fail("Seeking the final chord must not select the previous chord"); } };
  SongContinuationPanel.prototype.followTime.call(panel, { timeSeconds: items[7].onset, generation: 9 });
  const withTinyRest = [{ onset: 0, end: 1 }, { onset: 1.000000000001, end: 2 }];
  assert.equal(regionIndexAt(withTinyRest, 1.0000000000005), -1);
});
test("rest and unresolved regions break continuation history instead of inventing chords", () => {
  const items = regions(["C", "G", "Am"]); items[1].symbol = null; items[1].rootPc = null;
  const source = createSongProgression({ scoreHarmony: { regions: items }, generation: 2 });
  assert.equal(progressionThroughSelection(source, 1).progression, null);
  assert.equal(progressionThroughSelection(source, 2).progression, "Am");
  items[1] = { ...regions(["G"])[0], onset: 3, end: 4 };
  const withRest = createSongProgression({ scoreHarmony: { regions: items }, generation: 2 });
  assert.equal(progressionThroughSelection(withRest, 2).progression, "G | Am");
  assert.throws(() => createSongProgression({ scoreHarmony: { regions: [{ onset: 0, end: 3 }, { onset: 2, end: 4 }] } }), /nonoverlapping/);
});
test("all canonical emitted chord symbols round trip into the progression parser", () => {
  for (const template of CHORD_TEMPLATES) for (const root of [0, 6, 10]) {
    assert.equal(parseChordSymbol(chordSymbol(root, template.id)).templateId, template.id);
  }
});
test("song fixture supports bounded continuation and a hypothetical second step without mutating music", () => {
  const original = JSON.stringify(song);
  const options = { progression: progressionThroughSelection(song, 7).progression, ranking: { preset: "functional", limit: 6 }, currentVoicing: "54 58 61" };
  const session = analyzeWorkbench(options);
  assert.equal(session.context.centerPc, 6);
  assert.ok(session.candidates.length > 0 && session.candidates.length <= 192);
  const selected = orderedContinuations(session, 1)[0];
  assert.equal(orderedContinuations(JSON.parse(JSON.stringify(session)), 1)[0].entry.presentation.symbol, selected.entry.presentation.symbol);
  const branch = processWorkbenchRequest({ type: "branch", options, chord: selected.entry.presentation.symbol });
  assert.equal(branch.hypothetical, true); assert.equal(branch.continuations.length, 3);
  assert.ok(session.candidates.every(entry => !entry.dimensions.corpusFrequency.available && !entry.dimensions.styleSimilarity.available));
  assert.equal(JSON.stringify(song), original);
});
test("ordered song references use one transposition and distinguish reordered or missing evidence", () => {
  const matches = matchProgressionReferences(regions(["D", "A", "Bm", "G"]));
  assert.ok(matches.some(match => match.reference.artist === "U2" && match.length === 4 && match.shift === 2));
  assert.equal(matchProgressionReferences(regions(["D", "Bm", "A", "G"])).length, 0);
  const missing = regions(["C", "G", "Am", "F"]); missing[1].rootPc = null;
  assert.equal(matchProgressionReferences(missing).length, 0);
  const rest = regions(["C", "G", "Am", "F"]); rest[1].onset = 2.5;
  assert.ok(!matchProgressionReferences(rest).some(match => match.length === 4));
});
test("same-root major/minor device is reported separately, including opposite direction", () => {
  assert.equal(matchProgressionReferences(song.regions).length, 0);
  const devices = sharedProgressionDevices(song.regions);
  assert.ok(devices.some(match => match.reference.title === "Creep" && match.sameDirection === false));
  assert.equal(sharedProgressionDevices(regions(["C", "G"])).length, 0);
});
test("personal feelings keep stable source/time provenance, replace their own moment and surface storage errors", () => {
  const storage = memory();
  const note = saveFeelingNote(storage, song, 2, "restless, hopeful, restless");
  assert.equal(note.raterType, "user"); assert.equal(note.sourceId, song.sourceId); assert.equal(note.onsetSeconds, 4);
  assert.deepEqual(note.tags.map(tag => tag.label), ["restless", "hopeful"]);
  saveFeelingNote(storage, song, 2, "surprised"); assert.equal(readFeelingNotes(storage).length, 1);
  saveFeelingNote(storage, { ...song, sourceId: "another-song" }, 2, "quiet"); assert.equal(readFeelingNotes(storage).length, 2);
  assert.throws(() => saveFeelingNote({ ...storage, setItem() { throw new Error("quota"); } }, song, 1, "tense"), /quota/);
  assert.throws(() => saveFeelingNote(storage, song, 1, ""), /Enter 1/);
  assert.deepEqual(readFeelingNotes({ getItem: () => '{"not":"a list"}' }), []);
});
test("invalid empirical/style evidence is rejected instead of silently turned into zero or 100%", () => {
  const candidate = { rootPc: 0, templateId: "major", pitchClasses: [0, 4, 7] };
  for (const invalid of [NaN, Infinity, -1, 1.5]) {
    assert.throws(() => scoreCorpusContinuation(candidate, { corpusEvidence: { "chord:0:major": invalid } }), /finite/);
    assert.throws(() => scoreStyleContinuation(candidate, { styleEvidence: { "chord:0:major": invalid } }), /finite/);
  }
  assert.throws(() => scoreCorpusContinuation(candidate, { corpusEvidence: { "chord:0:major": { count: 8, total: 4 } } }), /corpus evidence/);
});
test("corrupt audio library data cannot crash initialization and failed writes are explicit", () => {
  for (const text of ['{}', 'null', '[null,42,{}]', 'broken']) assert.deepEqual(FingerprintExplorer.prototype.read.call({ storage: { getItem: () => text } }), []);
  assert.equal(FingerprintExplorer.prototype.write.call({ corpus: [], storage: { setItem() { throw new Error("quota"); } } }), false);
});
test("score/audio labels clear during silence instead of falling back to the first chord", () => {
  const stub = { harmonyCard: {}, scoreHarmony: { regions: [{ onset: 1, end: 2 }] },
    harmonyRegionEls: [{ classList: { toggle(name, value) { assert.equal(value, false); } } }], harmonySegmentEls: [],
    harmonyCurrent: {}, harmonyFunction: {}, harmonyAlternatives: {}, renderSilentHarmony: CollectionAwareHolographicHarmonyApp.prototype.renderSilentHarmony };
  CollectionAwareHolographicHarmonyApp.prototype.renderHarmonicAt.call(stub, 0);
  assert.equal(stub.harmonyCurrent.textContent, "No sounding chord");
});

test("manual sketch mode tracks the song clock without replacing its text and returns to the current chord", () => {
  const prototype = SongContinuationPanel.prototype;
  const panel = { song, sourceMode: { value: "manual" }, progression: { value: "Dm | G | C" },
    manualProgression: "old sketch", follow: { checked: true }, selectedIndex: 0,
    followLabel: {}, chordControls: {}, feelingsControls: {}, actualNext: {}, referenceOutput: { replaceChildren() {} },
    invalidateAnalysis() {}, select(index, options) { this.selection = { index, options }; } };
  prototype.followTime.call(panel, { timeSeconds: 6.5, generation: 999 });
  assert.equal(panel.playbackTime, undefined);
  prototype.followTime.call(panel, { timeSeconds: 6.5, generation: song.generation });
  assert.equal(panel.progression.value, "Dm | G | C");
  assert.equal(panel.selection, undefined);
  panel.sourceMode.value = "song";
  prototype.changeSourceMode.call(panel);
  assert.equal(panel.manualProgression, "Dm | G | C");
  assert.equal(panel.selection.index, 3);
  assert.equal(panel.progression.readOnly, true);
  panel.sourceMode.value = "manual";
  panel.progression.value = "F# | D#m";
  prototype.changeSourceMode.call(panel);
  assert.equal(panel.progression.value, "Dm | G | C");
});

test("pinned song analysis only uses the field rendered for the same song and chord interval", () => {
  const app = { visualizer: { currentTrack: {}, activeField: [0, 4, 7], generation: song.generation, lastRenderTime: 5 } };
  const context = () => HarmonicSavantApp.prototype.currentHolographicContext.call(app, song.regions[2], song);
  assert.deepEqual(context().activeField, [0, 4, 7]);
  app.visualizer.lastRenderTime = song.regions[2].end;
  assert.equal(context(), null);
  app.visualizer.lastRenderTime = 5; app.visualizer.generation++;
  assert.equal(context(), null);
});

test("edited options terminate their worker and stale or wrong-id replies cannot replace newer analysis", t => {
  const oldWorker = globalThis.Worker;
  t.after(() => { globalThis.Worker = oldWorker; });
  const workers = [];
  globalThis.Worker = class {
    constructor() { this.listeners = {}; workers.push(this); }
    addEventListener(type, listener) { this.listeners[type] = listener; }
    postMessage(message) { this.message = message; }
    terminate() { this.terminated = true; }
    reply(data) { this.listeners.message({ data }); }
  };
  const prototype = SongContinuationPanel.prototype;
  const panel = { requestId: 0, runButton: {}, exportButton: {}, output: { replaceChildren() {} }, actionStatus: {},
    progression: { value: "C | G" }, sourceMode: { value: "song" }, cancelAnalysis: prototype.cancelAnalysis };
  const results = [];
  prototype.request.call(panel, { type: "analyze" }, result => results.push(result), assert.fail);
  const first = workers[0];
  prototype.invalidateAnalysis.call(panel);
  assert.equal(first.terminated, true);
  first.reply({ id: first.message.id, result: "stale" });
  prototype.request.call(panel, { type: "analyze" }, result => results.push(result), assert.fail);
  const latest = workers[1];
  latest.reply({ id: first.message.id, result: "wrong id" });
  assert.equal(panel.worker, latest);
  latest.reply({ id: latest.message.id, result: "current" });
  assert.deepEqual(results, ["current"]);
  assert.equal(panel.worker, null);
  assert.equal(panel.runButton.disabled, false);
});

test("a worker post failure terminates local work and leaves the explore control usable", t => {
  const oldWorker = globalThis.Worker;
  t.after(() => { globalThis.Worker = oldWorker; });
  let terminated = false;
  globalThis.Worker = class { addEventListener() {} postMessage() { throw new Error("clone failed"); } terminate() { terminated = true; } };
  const prototype = SongContinuationPanel.prototype;
  const panel = { requestId: 0, runButton: {}, cancelAnalysis: prototype.cancelAnalysis };
  assert.throws(() => prototype.request.call(panel, {}, assert.fail, assert.fail), /clone failed/);
  assert.equal(terminated, true); assert.equal(panel.worker, null); assert.equal(panel.runButton.disabled, false);
});

test("feeling-note corruption and capacity never silently delete previously saved annotations", () => {
  const storage = memory();
  const note = saveFeelingNote(storage, song, 2, "restless");
  for (const invalid of [{ ...note, endSeconds: -1 }, { ...note, tags: [] }, { ...note, tags: [{ label: "quiet", weight: null }] }]) {
    const original = JSON.stringify([note, invalid]); storage.setItem(FEELING_NOTES_KEY, original);
    assert.equal(readFeelingNotes(storage).length, 1);
    assert.throws(() => saveFeelingNote(storage, song, 1, "hopeful"), /preserved/);
    assert.equal(storage.getItem(FEELING_NOTES_KEY), original);
    assert.throws(() => readFeelingNotes(storage, { strict: true }), /unsupported/);
  }
  const full = [note, ...Array.from({ length: 999 }, (_, index) => ({ ...note, sourceId: `other:${index}` }))];
  storage.setItem(FEELING_NOTES_KEY, JSON.stringify(full));
  assert.throws(() => saveFeelingNote(storage, song, 1, "hopeful"), /limit/);
  assert.equal(readFeelingNotes(storage).length, 1000);
  saveFeelingNote(storage, song, 2, "quiet");
  assert.equal(readFeelingNotes(storage).length, 1000);
  assert.equal(readFeelingNotes(storage).at(-1).tags[0].label, "quiet");
});

test("missing reference regions form barriers and history limits remain bounded", () => {
  const missing = regions(["C", "G", "Am", "F"]); missing[1] = null;
  assert.deepEqual(matchProgressionReferences(missing), []);
  assert.deepEqual(sharedProgressionDevices(missing), []);
  for (const limit of [0, -1, NaN, Infinity, 257, 1.5]) assert.throws(() => progressionThroughSelection(song, 7, { limit }), /History limit/);
  assert.equal(progressionThroughSelection(song, 7, { limit: 1 }).progression, "F#");
});
