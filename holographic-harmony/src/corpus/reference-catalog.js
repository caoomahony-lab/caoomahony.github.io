import { SCORE_COMPARISON_VERSION, SCORE_COMPONENTS, SCORE_DISTRIBUTION_COMPONENTS,
  validateScoreComparison, validateScoreDistributionSummary, compareScoreDistributionSummaries } from "../similarity/score-comparison.js";

export const REFERENCE_CATALOG_VERSION = "reference-catalog-v1";
export const CATALOG_SHORTLIST_LIMIT = 20;
const hash = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const labels = value => Array.isArray(value) && value.length <= 100 && value.every(item => typeof item === "string" && item.length > 0 && item.length <= 300);
export function validateReferenceCatalog(catalog) {
  if (catalog?.version !== REFERENCE_CATALOG_VERSION || catalog.analysisVersion !== SCORE_COMPARISON_VERSION ||
      typeof catalog.id !== "string" || !catalog.id || !catalog.source?.doi || !catalog.source?.selection ||
      !Array.isArray(catalog.records) || !catalog.records.length || catalog.records.length > 5000 || catalog.count !== catalog.records.length) return false;
  const ids = new Set(), sources = new Set(), shards = new Map();
  return catalog.records.every(record => {
    if (typeof record?.id !== "string" || !record.id || ids.has(record.id) || sources.has(record.summary?.sourceId) ||
        typeof record.title !== "string" || !record.title || typeof record.composer !== "string" ||
        !labels(record.genres) || !labels(record.instruments) || !labels(record.tags) ||
        !hash(record.sha256) || record.summary?.sourceId !== `sha256:${record.sha256}` ||
        !validateScoreDistributionSummary(record.summary) || !/^shards\/pdmx-\d{3}\.json$/.test(record.descriptorFile) ||
        !hash(record.descriptorSha256) || (shards.has(record.descriptorFile) && shards.get(record.descriptorFile) !== record.descriptorSha256) ||
        record.rights?.license !== "publicdomain" || record.rights?.licenseConflict !== false ||
        !Number.isInteger(record.counts?.notes) || record.counts.notes <= 0 || !Number.isInteger(record.counts.regions) || record.counts.regions <= 0) return false;
    ids.add(record.id); sources.add(record.summary.sourceId); shards.set(record.descriptorFile, record.descriptorSha256); return true;
  });
}

export function shortlistReferenceCatalog(current, catalog, { rankBy = "pitchContent", query = "", composer = "", genre = "", instrument = "", limit = CATALOG_SHORTLIST_LIMIT } = {}) {
  if (!validateScoreComparison(current) || !validateReferenceCatalog(catalog)) throw new TypeError("Valid score and compatible reference catalog required");
  if (!SCORE_COMPONENTS.some(component => component.key === rankBy)) throw new RangeError("Unknown catalog comparison component");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RangeError("Catalog shortlist limit must be 1–50");
  const term = String(query).trim().toLocaleLowerCase();
  if (term.length > 300) throw new RangeError("Catalog query is too long");
  const histogramRank = SCORE_DISTRIBUTION_COMPONENTS.includes(rankBy);
  const shortlistBy = histogramRank ? rankBy : "pitchContent";
  const records = catalog.records.filter(record => (!composer || record.composer === composer) && (!genre || record.genres.includes(genre)) && (!instrument || record.instruments.includes(instrument)) &&
    (!term || [record.title, record.composer, ...record.tags].join(" ").toLocaleLowerCase().includes(term)));
  const ranked = records.map(record => ({ id: record.id, summaryComparison: compareScoreDistributionSummaries(current, record.summary, { rankBy: shortlistBy }) }))
    .sort((a, b) => (a.summaryComparison.distance ?? Infinity) - (b.summaryComparison.distance ?? Infinity) || a.id.localeCompare(b.id));
  const comparable = ranked.filter(item => item.summaryComparison.distance != null);
  return { catalogId: catalog.id, catalogVersion: catalog.version, analysisVersion: catalog.analysisVersion,
    rankBy, shortlistBy, scope: histogramRank ? "exhaustive-feature-ranking" : "pitch-shortlist-order-reranking",
    totalRecords: catalog.count, filteredRecords: records.length, comparableRecords: comparable.length,
    unavailableRecords: ranked.length - comparable.length, limit,
    filters: { query: String(query).trim(), composer, genre, instrument },
    items: comparable.slice(0, limit),
    note: histogramRank ? "The selected distribution component is ranked over every filtered catalog record; full eight-component comparisons are calculated for the leading candidates."
      : `The leading ${Math.min(limit, comparable.length)} pitch-content candidates are reranked by ${rankBy}. This is a shortlist search, not a guaranteed whole-catalog order-nearest result.` };
}

export function validateCatalogDescriptor(record, descriptor) {
  return validateScoreComparison(descriptor) && descriptor.sourceId === record.summary.sourceId &&
    descriptor.counts.notes === record.counts.notes && descriptor.counts.regions === record.counts.regions &&
    JSON.stringify(descriptor.distributions) === JSON.stringify(record.summary.distributions);
}
