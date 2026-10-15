import test from "node:test";
import assert from "node:assert/strict";
import { deriveAudioFingerprint, fingerprintDistance, FINGERPRINT_DIMENSIONS, FingerprintExplorer, usableAudioDescriptor } from "../src/app/fingerprint-explorer.js";
import { browserStorage } from "../src/app/browser-storage.js";

test("audio library preserves unreadable saved records when saving usable records", () => {
  const valid = { title: "usable", features: Object.fromEntries(FINGERPRINT_DIMENSIONS.map(([key]) => [key, .5])) };
  const invalid = { title: "recoverable data", privateMarker: "preserve" };
  let written;
  const panel = { storage: { getItem: () => JSON.stringify([valid, invalid]), setItem: (_, value) => { written = JSON.parse(value); } } };
  panel.corpus = FingerprintExplorer.prototype.read.call(panel);
  assert.deepEqual(panel.corpus, [valid]); assert.deepEqual(panel.unreadableRecords, [invalid]);
  assert.equal(FingerprintExplorer.prototype.write.call(panel), true);
  assert.deepEqual(written, [valid, invalid]);
});

test("malformed audio library storage cannot be silently overwritten", () => {
  let writes = 0;
  for (const raw of ["invalid json", '{"unexpected":"object"}']) {
    const panel = { storage: { getItem: () => raw, setItem() { writes++; } } };
    panel.corpus = FingerprintExplorer.prototype.read.call(panel);
    assert.deepEqual(panel.corpus, []); assert.equal(panel.storageReadFailed, true);
    assert.equal(FingerprintExplorer.prototype.write.call(panel), false);
  }
  assert.equal(writes, 0);
});

test("malformed audio descriptors are excluded before comparison", () => {
  assert.equal(usableAudioDescriptor({ version: "pairwise-evidence-audit-v1" }, { audited: true }), false);
  const fp = deriveAudioFingerprint({ analysis: {}, harmony: {} });
  assert.equal(usableAudioDescriptor(fp.auditDescriptor, { audited: true }), true);
  assert.equal(usableAudioDescriptor(fp.descriptor), true);
  assert.equal(usableAudioDescriptor({ ...fp.auditDescriptor, summary: { ...fp.auditDescriptor.summary, style: { chroma: "malformed" } } }, { audited: true }), false);
});

test("blocked localStorage property is a supported unavailable-storage state", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
  try { assert.equal(browserStorage(), null); }
  finally { if (previous) Object.defineProperty(globalThis, "localStorage", previous); else delete globalThis.localStorage; }
});

test("fingerprint explorer derives bounded local-audio dimensions", () => {
  const frames=[
    {chroma:[1,0,0,0,0,0,0,0,0,0,0,0]},
    {chroma:[0.8,0,0,0,0.2,0,0,0,0,0,0,0]},
    {chroma:[0.6,0,0,0,0.4,0,0,0,0,0,0,0]}
  ];
  const fp=deriveAudioFingerprint({
    title:"test.mp3",
    analysis:{version:"audio-test",frames,overallChroma:[0.7,0,0,0,0.3,0,0,0,0,0,0,0],durationSeconds:10,registeredNoteEvents:[{}, {}, {}]},
    harmony:{version:"harmony-test",regions:[
      {rootPc:0,templateId:"major",duration:3},
      {rootPc:7,templateId:"major",duration:3},
      {rootPc:0,templateId:"major",duration:4}
    ]},
    collectionCandidate:{pcs:[0,2,4,5,7,9,11],confidence:0.72}
  });
  assert.equal(fp.title,"test.mp3");
  assert.equal(Object.keys(fp.features).length,FINGERPRINT_DIMENSIONS.length);
  for(const value of Object.values(fp.features)) assert.ok(value>=0&&value<=1);
  assert.ok(fp.features.recurrence>0);
  assert.ok(fp.features.collection>0.9);
});

test("fingerprint distance is symmetric and zero for identical targets", () => {
  const a={motion:.1,recurrence:.2,center:.3,collection:.4,diversity:.5,activity:.6};
  const b={motion:.6,recurrence:.5,center:.4,collection:.3,diversity:.2,activity:.1};
  assert.equal(fingerprintDistance(a,a),0);
  assert.equal(fingerprintDistance(a,b),fingerprintDistance(b,a));
  assert.ok(fingerprintDistance(a,b)>0);
});
