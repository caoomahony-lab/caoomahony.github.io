import { validateHarmonicFingerprintV1 } from "./schema.js";

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

export function serializeHarmonicFingerprint(fingerprint, { pretty = true } = {}) {
  if (!validateHarmonicFingerprintV1(fingerprint)) throw new TypeError("Invalid HarmonicFingerprintV1");
  return JSON.stringify(canonicalize(fingerprint), null, pretty ? 2 : 0);
}

export function parseHarmonicFingerprint(jsonText) {
  const parsed = JSON.parse(String(jsonText));
  if (!validateHarmonicFingerprintV1(parsed)) throw new TypeError("Unsupported or invalid HarmonicFingerprintV1 JSON");
  return parsed;
}
