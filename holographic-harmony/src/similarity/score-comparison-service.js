import { deriveScoreComparison, deriveScoreComparisonFromHIR, compareScoreComparisons } from "./score-comparison.js";
import { buildScoreHIR } from "../model/harmonic-ir.js";
import { extractHarmonicFingerprintFromHIR } from "../fingerprint/hir-extract.js";
import { shortlistReferenceCatalog } from "../corpus/reference-catalog.js";

export function processScoreComparisonRequest(request) {
  if (request?.type === "derive") return deriveScoreComparison(request.events, request.options);
  if (request?.type === "analyze") {
    try {
      const hir = buildScoreHIR(request.events, request.options);
      return { hir, fingerprint: extractHarmonicFingerprintFromHIR(hir), scoreDescriptor: deriveScoreComparisonFromHIR(hir), advancedError: null };
    } catch (error) {
      return { hir: null, fingerprint: null, scoreDescriptor: deriveScoreComparison(request.events, request.options), advancedError: error.message };
    }
  }
  if (request?.type === "catalog-shortlist") return shortlistReferenceCatalog(request.current, request.catalog, request.options);
  if (request?.type === "compare") return request.pieces.map(piece => ({ id: piece.id,
    comparison: compareScoreComparisons(request.current, piece.scoreDescriptor, request.options) }));
  throw new TypeError("Unknown score comparison request");
}
