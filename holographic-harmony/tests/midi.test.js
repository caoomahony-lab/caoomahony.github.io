import test from "node:test";
import assert from "node:assert/strict";
import { parseMidiFile } from "../src/music/midi.js";

function vlq(value) {
  const bytes = [value & 0x7f];
  value >>= 7;
  while (value > 0) { bytes.unshift((value & 0x7f) | 0x80); value >>= 7; }
  return bytes;
}
function u32(value) { return [(value>>>24)&255,(value>>>16)&255,(value>>>8)&255,value&255]; }
function makeMidi() {
  const track=[
    0x00,0xff,0x51,0x03,0x07,0xa1,0x20,
    0x00,0xff,0x58,0x04,0x04,0x02,0x18,0x08,
    0x00,0x90,60,96,
    ...vlq(480),0x80,60,0,
    0x00,0x90,64,88,
    ...vlq(480),0x80,64,0,
    0x00,0xff,0x2f,0x00
  ];
  return Uint8Array.from([
    0x4d,0x54,0x68,0x64,0,0,0,6,0,0,0,1,1,0xe0,
    0x4d,0x54,0x72,0x6b,...u32(track.length),...track
  ]).buffer;
}

test("MIDI import converts PPQ notes tempo and meter into canonical score time", () => {
  const parsed=parseMidiFile(makeMidi(),{trackId:"fixture"});
  assert.equal(parsed.version,"midi-import-v1");
  assert.equal(parsed.notes.length,2);
  assert.deepEqual(parsed.notes.map(n=>n.midi),[60,64]);
  assert.deepEqual(parsed.notes.map(n=>n.qBeat),[0,1]);
  assert.deepEqual(parsed.notes.map(n=>n.durationQ),[1,1]);
  assert.ok(Math.abs(parsed.notes[1].onset-0.5)<1e-9);
  assert.equal(parsed.tempoEvents[0].bpm,120);
  assert.deepEqual(parsed.timeSignatureEvents[0],{qBeat:0,beats:4,beatType:4});
  assert.equal(parsed.eventsV1[0].source,"midi");
  assert.equal(parsed.eventsV1[0].velocity,96);
});

test("MIDI import rejects SMPTE division rather than guessing score time", () => {
  const bytes=new Uint8Array(makeMidi()); bytes[12]=0xe7; bytes[13]=0x28;
  assert.throws(()=>parseMidiFile(bytes),/SMPTE-time MIDI is not supported/);
});
