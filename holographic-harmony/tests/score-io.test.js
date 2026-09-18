import test from "node:test";
import assert from "node:assert/strict";
import { LiteDOMParser } from "../src/music/xml-lite.js";
import { classifyScoreFile, prepareLocalScoreFile } from "../src/music/score-io.js";

function textFile(name,type,text){ return {name,type,async text(){return text;}}; }

test("score I/O classifies MusicXML MXL and MIDI separately", () => {
  assert.equal(classifyScoreFile({name:"a.musicxml",type:""}),"musicxml");
  assert.equal(classifyScoreFile({name:"a.musicxml",type:"application/vnd.recordare.musicxml+xml"}),"musicxml");
  assert.equal(classifyScoreFile({name:"a.xml",type:"application/xml"}),"musicxml");
  assert.equal(classifyScoreFile({name:"a.mxl",type:""}),"mxl");
  assert.equal(classifyScoreFile({name:"a.mid",type:"audio/midi"}),"midi");
  assert.equal(classifyScoreFile({name:"a.txt",type:"text/plain"}),"unknown");
});

test("plain MusicXML preparation preserves original export and builds normalized XML", async () => {
  const xml='<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note></measure></part></score-partwise>';
  const prepared=await prepareLocalScoreFile(textFile("tiny.musicxml","application/xml",xml),LiteDOMParser);
  assert.equal(prepared.sourceFormat,"musicxml");
  assert.equal(prepared.exportXml,xml);
  assert.equal(prepared.exportFilename,"tiny.musicxml");
  assert.match(prepared.normalizedXml,/Harmonic Savant/);
  assert.equal(prepared.parsed.notes.length,1);
});
