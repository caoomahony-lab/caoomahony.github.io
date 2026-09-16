import { mod12 } from "../../theory/pitch.js";

function normalizeField(referenceField) {
  if (!referenceField || typeof referenceField[Symbol.iterator] !== "function") throw new TypeError("referenceField must be iterable");
  return Object.freeze([...new Set(Array.from(referenceField, mod12))].sort((a,b) => a-b));
}

function durationOf(event) {
  const direct = Number(event.durationSec);
  if (Number.isFinite(direct) && direct >= 0) return direct;
  const onset = Number(event.onsetSec ?? event.onset ?? 0);
  const end = Number(event.endSec ?? (Number.isFinite(Number(event.duration)) ? onset + Number(event.duration) : onset));
  return Math.max(0, end - onset);
}

function onsetOf(event) {
  const value = Number(event.onsetSec ?? event.onset ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function endOf(event) { return onsetOf(event) + durationOf(event); }

function normalizedConcentration(shares) {
  const n = shares.length;
  if (n <= 1) return n === 1 ? 1 : 0;
  const hhi = shares.reduce((sum, share) => sum + share * share, 0);
  return Math.max(0, Math.min(1, (hhi - 1/n) / (1 - 1/n)));
}

function mergeEpisodes(events, gapSec) {
  if (!events.length) return [];
  const sorted = [...events].sort((a,b) => onsetOf(a) - onsetOf(b) || endOf(a) - endOf(b));
  const episodes = [];
  let start = onsetOf(sorted[0]);
  let end = endOf(sorted[0]);
  let count = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const eventStart = onsetOf(sorted[i]);
    const eventEnd = endOf(sorted[i]);
    if (eventStart <= end + gapSec) {
      end = Math.max(end, eventEnd);
      count += 1;
    } else {
      episodes.push({start,end,count});
      start = eventStart;
      end = eventEnd;
      count = 1;
    }
  }
  episodes.push({start,end,count});
  return episodes;
}

export function extractChromaticStrategy(events, {
  referenceField,
  centerPc = null,
  episodeGapSec = 0.25,
  centerChangeTimes = [],
  centerChangeLookaheadSec = 2
} = {}) {
  if (!Array.isArray(events)) throw new TypeError("events must be an array");
  const field = normalizeField(referenceField);
  const fieldSet = new Set(field);
  const valid = events.filter((event) => event && Number.isFinite(Number(event.pitchClass)));
  const foreign = valid.filter((event) => !fieldSet.has(mod12(event.pitchClass)));
  const totalDuration = valid.reduce((sum,event) => sum + durationOf(event), 0);
  const foreignDuration = foreign.reduce((sum,event) => sum + durationOf(event), 0);
  const durationByPc = Array(12).fill(0);
  const attackByPc = Array(12).fill(0);
  for (const event of foreign) {
    const pc = mod12(event.pitchClass);
    durationByPc[pc] += durationOf(event);
    attackByPc[pc] += 1;
  }
  const activeForeignPcs = durationByPc.map((value,pc) => ({pc,value})).filter((item) => item.value > 0 || attackByPc[item.pc] > 0);
  const durationShareDenom = activeForeignPcs.reduce((sum,item) => sum + item.value, 0);
  const concentrationShares = activeForeignPcs.map((item) => durationShareDenom > 0 ? item.value / durationShareDenom : attackByPc[item.pc] / Math.max(1, foreign.length));
  const dominant = [...activeForeignPcs].sort((a,b) => b.value - a.value || attackByPc[b.pc] - attackByPc[a.pc] || a.pc-b.pc)[0] || null;
  const dominantShare = dominant ? (durationShareDenom > 0 ? dominant.value / durationShareDenom : attackByPc[dominant.pc] / Math.max(1, foreign.length)) : 0;

  const sortedForeign = [...foreign].sort((a,b) => onsetOf(a)-onsetOf(b));
  let repeats = 0;
  for (let i = 1; i < sortedForeign.length; i += 1) if (mod12(sortedForeign[i].pitchClass) === mod12(sortedForeign[i-1].pitchClass)) repeats += 1;
  const episodes = mergeEpisodes(foreign, Math.max(0, Number(episodeGapSec) || 0));
  const episodeConcentration = foreign.length ? Math.max(0, 1 - episodes.length / foreign.length) : 0;
  let episodesBeforeCenterChange = 0;
  for (const episode of episodes) {
    if (centerChangeTimes.some((time) => Number(time) >= episode.end && Number(time) - episode.end <= centerChangeLookaheadSec)) episodesBeforeCenterChange += 1;
  }

  const relativeDistribution = centerPc == null ? null : Array(12).fill(0);
  if (relativeDistribution) {
    for (let pc = 0; pc < 12; pc += 1) relativeDistribution[mod12(pc-centerPc)] = durationShareDenom > 0 ? durationByPc[pc] / durationShareDenom : 0;
  }

  return Object.freeze({
    referenceField: field,
    onsetOutsideRate: valid.length ? foreign.length / valid.length : 0,
    durationOutsideRate: totalDuration ? foreignDuration / totalDuration : 0,
    distinctOutsideFieldClasses: activeForeignPcs.length,
    outsideClassConcentration: normalizedConcentration(concentrationShares),
    averageForeignEventDurationSec: foreign.length ? foreignDuration / foreign.length : 0,
    foreignRepeatRate: foreign.length > 1 ? repeats / (foreign.length - 1) : 0,
    foreignEpisodeCount: episodes.length,
    foreignEpisodeConcentration: episodeConcentration,
    meanForeignEpisodeDurationSec: episodes.length ? episodes.reduce((sum,episode) => sum + Math.max(0, episode.end-episode.start),0) / episodes.length : 0,
    centerChangePrecedenceRate: episodes.length ? episodesBeforeCenterChange / episodes.length : 0,
    dominantForeignPc: dominant?.pc ?? null,
    dominantForeignShare: dominantShare,
    outsideRelativeDurationDistribution: relativeDistribution ? Object.freeze(relativeDistribution) : null,
    foreignEventCount: foreign.length,
    evidenceClass: "deterministic-under-reference-field"
  });
}
