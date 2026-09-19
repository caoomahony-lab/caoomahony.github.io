import { estimateConstrainedLocalAlignment } from "./local-timing-alignment.js";

export const AUDIO_SCORE_COMPARISON_VERSION = "audio-score-comparison-v2";

const EPSILON = 1e-9;

function pitchClasses(region, measured = false) {
  const values = measured
    ? (region.measuredPitchClasses || region.observedPitchClasses || region.pcs || [])
    : (region.observedPitchClasses || region.pcs || region.measuredPitchClasses || []);
  return [...new Set(values.map((pc) => ((Number(pc) % 12) + 12) % 12))].sort((a, b) => a - b);
}

function jaccard(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  const union = new Set([...left, ...right]);
  if (!union.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / union.size;
}

function exactSet(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function overlapSeconds(audio, score, offset) {
  return Math.max(0, Math.min(Number(audio.end), Number(score.end) + offset) -
    Math.max(Number(audio.onset), Number(score.onset) + offset));
}

function validateTimeline(regions, name) {
  if (!Array.isArray(regions) || !regions.length) throw new TypeError(`${name} must be a nonempty array`);
  return regions.map((region, index) => {
    const onset = Number(region?.onset);
    const end = Number(region?.end);
    if (!Number.isFinite(onset) || !Number.isFinite(end) || end <= onset) {
      throw new TypeError(`${name}[${index}] must provide finite onset < end`);
    }
    return region;
  });
}

function durationOf(regions) {
  return regions.reduce((sum, region) => sum + Math.max(0, Number(region.end) - Number(region.onset)), 0);
}

function metricsAtOffset(audioRegions, scoreRegions, offset) {
  let overlap = 0;
  let rootComparable = 0;
  let rootMatch = 0;
  let pitchAgreement = 0;
  let exactPitchMatch = 0;
  let templateComparable = 0;
  let templateMatch = 0;
  const rootConfusions = new Map();
  const qualityConfusions = new Map();

  for (const audio of audioRegions) {
    for (const score of scoreRegions) {
      const seconds = overlapSeconds(audio, score, offset);
      if (seconds <= EPSILON) continue;
      overlap += seconds;
      const audioPcs = pitchClasses(audio, false);
      const scorePcs = pitchClasses(score, true);
      const setAgreement = jaccard(audioPcs, scorePcs);
      pitchAgreement += seconds * setAgreement;
      if (exactSet(audioPcs, scorePcs)) exactPitchMatch += seconds;

      const audioRoot = audio.rootPc == null ? null : Number(audio.rootPc);
      const scoreRoot = score.rootPc == null ? null : Number(score.rootPc);
      if (audioRoot != null && scoreRoot != null) {
        rootComparable += seconds;
        if (audioRoot === scoreRoot) rootMatch += seconds;
        else {
          const key = `${scoreRoot}->${audioRoot}`;
          rootConfusions.set(key, (rootConfusions.get(key) || 0) + seconds);
        }
      }

      if (audio.templateId && score.templateId) {
        templateComparable += seconds;
        if (audio.templateId === score.templateId) templateMatch += seconds;
        else if (audioRoot === scoreRoot) {
          const key = `${score.templateId}->${audio.templateId}`;
          qualityConfusions.set(key, (qualityConfusions.get(key) || 0) + seconds);
        }
      }
    }
  }

  const totalAudio = durationOf(audioRegions);
  const coverage = totalAudio > 0 ? Math.min(1, overlap / totalAudio) : 0;
  const rootAgreement = rootComparable > 0 ? rootMatch / rootComparable : null;
  const pitchSetAgreement = overlap > 0 ? pitchAgreement / overlap : null;
  const exactPitchSetAgreement = overlap > 0 ? exactPitchMatch / overlap : null;
  const templateAgreement = templateComparable > 0 ? templateMatch / templateComparable : null;
  const available = [
    rootAgreement == null ? null : { value: rootAgreement, weight: 0.5 },
    pitchSetAgreement == null ? null : { value: pitchSetAgreement, weight: 0.35 },
    exactPitchSetAgreement == null ? null : { value: exactPitchSetAgreement, weight: 0.15 }
  ].filter(Boolean);
  const weight = available.reduce((sum, item) => sum + item.weight, 0) || 1;
  const agreement = available.reduce((sum, item) => sum + item.value * item.weight, 0) / weight;

  return {
    offset,
    overlap,
    coverage,
    rootComparable,
    rootAgreement,
    pitchSetAgreement,
    exactPitchSetAgreement,
    templateAgreement,
    objective: agreement * coverage,
    rootConfusions,
    qualityConfusions,
    unresolvedSeconds: Math.max(0, totalAudio - overlap)
  };
}

function confusionSummary(map, [leftName, rightName]) {
  return Object.freeze([...map.entries()]
    .map(([key, seconds]) => {
      const [left, right] = key.split("->");
      return Object.freeze({
        [leftName]: /^\d+$/.test(left) ? Number(left) : left,
        [rightName]: /^\d+$/.test(right) ? Number(right) : right,
        seconds
      });
    })
    .sort((a, b) => b.seconds - a.seconds ||
      String(a[leftName]).localeCompare(String(b[leftName])) ||
      String(a[rightName]).localeCompare(String(b[rightName]))));
}

function boundaryMetrics(audioRegions, scoreRegions, offset, tolerance) {
  const audioBoundaries = audioRegions.slice(1).map((region) => Number(region.onset));
  const scoreBoundaries = scoreRegions.slice(1).map((region) => Number(region.onset) + offset);
  const used = new Set();
  const errors = [];

  for (const audioTime of audioBoundaries) {
    let bestIndex = -1;
    let bestError = Infinity;
    for (let index = 0; index < scoreBoundaries.length; index += 1) {
      if (used.has(index)) continue;
      const error = Math.abs(audioTime - scoreBoundaries[index]);
      if (error <= tolerance && error < bestError) {
        bestIndex = index;
        bestError = error;
      }
    }
    if (bestIndex >= 0) {
      used.add(bestIndex);
      errors.push(bestError);
    }
  }

  const matched = errors.length;
  return Object.freeze({
    toleranceSeconds: tolerance,
    audioBoundaryCount: audioBoundaries.length,
    scoreBoundaryCount: scoreBoundaries.length,
    matchedBoundaryCount: matched,
    precision: audioBoundaries.length ? matched / audioBoundaries.length : null,
    recall: scoreBoundaries.length ? matched / scoreBoundaries.length : null,
    meanAbsoluteErrorSeconds: matched
      ? errors.reduce((sum, error) => sum + error, 0) / matched
      : null
  });
}

export function compareAudioToScore(audioRegionsRaw, scoreRegionsRaw, options = {}) {
  const audioRegions = validateTimeline(audioRegionsRaw, "audioRegions");
  const scoreRegions = validateTimeline(scoreRegionsRaw, "scoreRegions");
  const maxOffsetSeconds = Math.max(0, Number(options.maxOffsetSeconds ?? 8));
  const offsetStepSeconds = Number(options.offsetStepSeconds ?? 0.1);
  if (!Number.isFinite(offsetStepSeconds) || offsetStepSeconds <= 0) {
    throw new TypeError("offsetStepSeconds must be positive");
  }

  let best = null;
  const stepCount = Math.ceil((maxOffsetSeconds * 2) / offsetStepSeconds);
  for (let index = 0; index <= stepCount; index += 1) {
    const offset = Math.min(maxOffsetSeconds, -maxOffsetSeconds + index * offsetStepSeconds);
    const candidate = metricsAtOffset(audioRegions, scoreRegions, offset);
    if (
      !best ||
      candidate.objective > best.objective + EPSILON ||
      (Math.abs(candidate.objective - best.objective) <= EPSILON &&
        Math.abs(candidate.offset) < Math.abs(best.offset))
    ) {
      best = candidate;
    }
  }

  const boundaryToleranceSeconds = Math.max(0, Number(options.boundaryToleranceSeconds ?? 0.5));
  const boundaries = boundaryMetrics(audioRegions, scoreRegions, best.offset, boundaryToleranceSeconds);
  const localAlignment = estimateConstrainedLocalAlignment(audioRegions, scoreRegions, {
    globalOffsetSeconds: best.offset,
    windowSeconds: options.localWindowSeconds,
    searchRadiusSeconds: options.localSearchRadiusSeconds,
    offsetStepSeconds: options.localOffsetStepSeconds,
    maxOffsetStepSeconds: options.localMaxOffsetStepSeconds,
    transitionPenalty: options.localTransitionPenalty
  });
  const inferredMicroSegmentCount = audioRegions.reduce(
    (sum, region) => sum + Math.max(1, Number(region.microSegmentCount) || 1),
    0
  );

  return Object.freeze({
    version: AUDIO_SCORE_COMPARISON_VERSION,
    alignmentMethod: "bounded-uniform-offset-search",
    estimatedAudioMinusScoreOffsetSeconds: best.offset,
    alignmentSearch: Object.freeze({
      maxOffsetSeconds,
      offsetStepSeconds,
      objective: "coverage-weighted-root-and-pitch-set-agreement"
    }),
    coverage: Object.freeze({
      comparedSeconds: best.overlap,
      audioCoverageShare: best.coverage,
      unresolvedAudioSeconds: best.unresolvedSeconds
    }),
    agreement: Object.freeze({
      timeWeightedRootAgreement: best.rootAgreement,
      rootComparableSeconds: best.rootComparable,
      timeWeightedPitchSetJaccard: best.pitchSetAgreement,
      timeWeightedExactPitchSetAgreement: best.exactPitchSetAgreement,
      timeWeightedChordTemplateAgreement: best.templateAgreement
    }),
    boundaries,
    localAlignment,
    rootConfusions: confusionSummary(best.rootConfusions, ["scoreRootPc", "audioRootPc"]),
    qualityConfusions: confusionSummary(best.qualityConfusions, ["scoreTemplateId", "audioTemplateId"]),
    counts: Object.freeze({
      microSegmentCount: Number(options.microSegmentCount ?? inferredMicroSegmentCount),
      audioRegionCount: audioRegions.length,
      scoreReferenceRegionCount: scoreRegions.length
    }),
    evidenceClasses: Object.freeze({
      audio: "inferred-from-audio",
      scoreSonority: "measured-from-score",
      scoreChordInterpretation: "inferred-from-score-sonority",
      alignment: "estimated",
      localAlignment: "estimated-validation-only"
    }),
    note: "Score note content is measured reference evidence; roots, chord qualities, functions, and both global/local timing alignment remain analytical inferences. Local timing alignment is validation-only and never alters the audio analysis."
  });
}
