import { inferScaleCandidates } from "./scales.js";

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function softmax(values, temperature = 0.055) {
  if (!values.length) return [];
  const max = Math.max(...values);
  const exps = values.map((value) => Math.exp((value - max) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((value) => value / sum);
}

export function collectionKey(pcs) {
  return [...new Set(Array.from(pcs || [], (pc) => ((Number(pc) % 12) + 12) % 12))]
    .sort((a, b) => a - b)
    .join(",");
}

export function sameCollection(a, b) {
  return collectionKey(a) === collectionKey(b);
}

export function describeCollection(pcs, members = []) {
  const major = members.find((candidate) => candidate.systemId === "major");
  const naturalMinor = members.find((candidate) => candidate.systemId === "natural-minor");
  if (major && naturalMinor) return `${major.rootName} / ${naturalMinor.rootName} minor collection`;

  const harmonicMinor = members.find((candidate) => candidate.systemId === "harmonic-minor");
  if (harmonicMinor) return `${harmonicMinor.rootName} harmonic-minor collection`;

  const lead = members[0];
  if (lead) return `${lead.label} collection`;
  const key = collectionKey(pcs);
  return key ? `Pitch-class collection {${key}}` : "Defined collection";
}

export function inferCollectionCandidates(activityRaw, options = {}) {
  const all = inferScaleCandidates(activityRaw, { limit: 96 });
  if (!all.length) return Object.freeze([]);

  const groups = new Map();
  for (const candidate of all) {
    const key = collectionKey(candidate.pcs);
    let group = groups.get(key);
    if (!group) {
      group = { key, pcs: candidate.pcs, members: [] };
      groups.set(key, group);
    }
    group.members.push(candidate);
  }

  const collections = [];
  for (const group of groups.values()) {
    group.members.sort((a, b) => b.support - a.support || a.rootPc - b.rootPc || a.systemId.localeCompare(b.systemId));
    const centerWeights = softmax(group.members.map((candidate) => candidate.support), Number(options.centerTemperature || 0.055));
    const centers = Object.freeze(group.members.map((candidate, index) => Object.freeze({
      ...candidate,
      relativeWeight: centerWeights[index],
      confidence: centerWeights[index]
    })));

    // Collection support intentionally ignores tonic identity. All modal readings of
    // the same pitch-class set therefore share one collection score.
    const insideShare = Number(group.members[0]?.insideShare || 0);
    const outsideShare = Number(group.members[0]?.outsideShare || 0);
    const support = clamp01(insideShare - 0.18 * outsideShare);
    collections.push(Object.freeze({
      key: group.key,
      pcs: Object.freeze([...group.pcs]),
      label: describeCollection(group.pcs, group.members),
      support,
      insideShare,
      outsideShare,
      centers
    }));
  }

  collections.sort((a, b) => b.support - a.support || b.centers[0].support - a.centers[0].support || a.key.localeCompare(b.key));
  const limit = Math.max(1, Number(options.limit || 12));
  return Object.freeze(collections.slice(0, limit));
}

export function selectStableCollection(collections, previousPcs = null, options = {}) {
  if (!collections?.length) return null;
  const top = collections[0];
  if (!previousPcs?.length) return top;

  const previousKey = collectionKey(previousPcs);
  const previous = collections.find((collection) => collection.key === previousKey);
  if (!previous || previous.key === top.key) return previous || top;

  const retainFloor = Number(options.retainFloor ?? 0.52);
  const switchMargin = Number(options.switchMargin ?? 0.065);
  const advantage = top.support - previous.support;

  if (previous.support >= retainFloor && advantage < switchMargin) return previous;
  return top;
}

export function inferCollectionCenterState(activityRaw, previousPcs = null, options = {}) {
  const collections = inferCollectionCandidates(activityRaw, options);
  const collection = selectStableCollection(collections, previousPcs, options);
  return Object.freeze({ collections, collection });
}
