import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { extractMusicXmlFromMxl } from "../src/music/mxl.js";

const u16=v=>[v&255,(v>>>8)&255];
const u32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];

function zip(entries) {
  const encoder=new TextEncoder(), locals=[], centrals=[]; let offset=0;
  for(const entry of entries) {
    const name=encoder.encode(entry.name), raw=encoder.encode(entry.text);
    const compressed=entry.deflate?new Uint8Array(deflateRawSync(raw)):raw;
    const method=entry.deflate?8:0;
    const local=Uint8Array.from([0x50,0x4b,0x03,0x04,...u16(20),...u16(0),...u16(method),...u16(0),...u16(0),...u32(0),...u32(compressed.length),...u32(raw.length),...u16(name.length),...u16(0),...name,...compressed]);
    const central=Uint8Array.from([0x50,0x4b,0x01,0x02,...u16(20),...u16(20),...u16(0),...u16(method),...u16(0),...u16(0),...u32(0),...u32(compressed.length),...u32(raw.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]);
    locals.push(local); centrals.push(central); offset+=local.length;
  }
  const centralOffset=offset, centralSize=centrals.reduce((sum,b)=>sum+b.length,0);
  const end=Uint8Array.from([0x50,0x4b,0x05,0x06,...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),...u32(centralSize),...u32(centralOffset),...u16(0)]);
  const chunks=[...locals,...centrals,end], length=chunks.reduce((sum,b)=>sum+b.length,0), out=new Uint8Array(length);
  let cursor=0; for(const chunk of chunks){ out.set(chunk,cursor); cursor+=chunk.length; } return out;
}

test("MXL extractor follows container.xml to a deflated MusicXML root", async () => {
  const container='<?xml version="1.0"?><container><rootfiles><rootfile full-path="scores/main.musicxml"/></rootfiles></container>';
  const score='<?xml version="1.0"?><score-partwise version="4.0"><part-list></part-list></score-partwise>';
  const archive=zip([{name:"META-INF/container.xml",text:container,deflate:true},{name:"scores/main.musicxml",text:score,deflate:true}]);
  const extracted=await extractMusicXmlFromMxl(archive);
  assert.equal(extracted.rootPath,"scores/main.musicxml");
  assert.equal(extracted.xmlText,score);
  assert.equal(extracted.entryCount,2);
});

test("MXL rejects forged expansion sizes before accumulating an oversized score", async () => {
  const score = `<score-partwise>${" ".repeat(50000)}</score-partwise>`;
  const archive = zip([{ name: "score.musicxml", text: score, deflate: true }]);
  const view = new DataView(archive.buffer);
  const central = view.getUint32(archive.length - 6, true);
  view.setUint32(central + 24, 32, true);
  await assert.rejects(extractMusicXmlFromMxl(archive), /exceeds.*declared size/);
});

test("MXL validates stored entry sizes, header bounds and finite resource limits", async () => {
  const original = zip([{ name: "score.musicxml", text: "<score-partwise/>" }]);
  const central = new DataView(original.buffer).getUint32(original.length - 6, true);
  const badSize = original.slice(); new DataView(badSize.buffer).setUint32(central + 24, 1, true);
  await assert.rejects(extractMusicXmlFromMxl(badSize), /size does not match/);
  const badOffset = original.slice(); new DataView(badOffset.buffer).setUint32(central + 42, original.length - 2, true);
  await assert.rejects(extractMusicXmlFromMxl(badOffset), /Invalid MXL local file header/);
  await assert.rejects(extractMusicXmlFromMxl(original, { maxUncompressedBytes: NaN }), /finite/);
});
