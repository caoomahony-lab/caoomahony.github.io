import { processScoreComparisonRequest } from "./score-comparison-service.js";

self.onmessage = ({ data }) => {
  try { self.postMessage({ id: data.id, result: processScoreComparisonRequest(data) }); }
  catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
