import { processWorkbenchRequest } from "./workbench-service.js";

self.addEventListener("message", ({ data }) => {
  try { self.postMessage({ id: data.id, result: processWorkbenchRequest(data) }); }
  catch (error) { self.postMessage({ id: data.id, error: error?.message || String(error) }); }
});
