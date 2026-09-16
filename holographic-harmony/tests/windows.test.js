import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { parseMusicXML } from "../src/music/musicxml.js";
import {
  DEFAULT_ANALYSIS_WINDOW_SPECS,
  createAnalysisWindows,
  createGlobalWindow,
  validateAnalysisWindowSpec
} from "../src/analysis/windows.js";

const xml = fs.readFileSync(new URL("../public/tracks/demo.musicxml", import.meta.url), "utf8");
const parsed = parseMusicXML(xml, LiteDOMParser, { trackId: "window-demo" });

test("window specs are validated and defaults cover local, phrase, and field resolutions", () => {
  assert.equal(DEFAULT_ANALYSIS_WINDOW_SPECS.local.mode, "beats");
  assert.equal(DEFAULT_ANALYSIS_WINDOW_SPECS.phrase.mode, "measures");
  assert.equal(DEFAULT_ANALYSIS_WINDOW_SPECS.field.mode, "measures");
  assert.throws(() => validateAnalysisWindowSpec({ id: "bad", mode: "seconds", size: 0, hop: 1, weighting: "uniform" }), /size/);
});

test("seconds windows select overlapping canonical events without mutating them", () => {
  const before = JSON.stringify(parsed.eventsV1);
  const windows = createAnalysisWindows(parsed.eventsV1, {
    id: "two-second",
    mode: "seconds",
    size: 2,
    hop: 1,
    weighting: "duration"
  });
  assert.ok(windows.length >= 16);
  assert.equal(windows[0].start, 0);
  assert.equal(windows[0].end, 2);
  assert.ok(windows[0].events.length > 0);
  assert.equal(windows[0].events.length, windows[0].weights.length);
  assert.equal(JSON.stringify(parsed.eventsV1), before);
  assert.equal(Object.isFrozen(windows), true);
});

test("beat and measure windows use score coordinates retained by NoteEventV1", () => {
  const beatWindows = createAnalysisWindows(parsed.eventsV1, DEFAULT_ANALYSIS_WINDOW_SPECS.local);
  const measureWindows = createAnalysisWindows(parsed.eventsV1, DEFAULT_ANALYSIS_WINDOW_SPECS.phrase);
  assert.ok(beatWindows.length > measureWindows.length);
  assert.equal(beatWindows[0].mode, "beats");
  assert.equal(measureWindows[0].mode, "measures");
  assert.ok(measureWindows[0].events.every((event) => event.measure >= 1 && event.measure <= 4));
});

test("duration weights equal overlap in the selected coordinate system", () => {
  const events = [Object.freeze({ onsetSec: 0.5, endSec: 2.5 })];
  const windows = createAnalysisWindows(events, {
    id: "overlap",
    mode: "seconds",
    size: 2,
    hop: 2,
    weighting: "duration"
  });
  assert.equal(windows[0].weights[0], 1.5);
  assert.equal(windows[1].weights[0], 0.5);
});

test("global window contains every event exactly once as members", () => {
  const global = createGlobalWindow(parsed.eventsV1);
  assert.equal(global.events.length, parsed.eventsV1.length);
  assert.deepEqual(global.eventIndices, parsed.eventsV1.map((_, index) => index));
});
