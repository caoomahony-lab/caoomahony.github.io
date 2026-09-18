export const MXL_IMPORT_VERSION = "mxl-import-v1";
const EOCD = 0x06054b50;
const CENTRAL_FILE = 0x02014b50;
const LOCAL_FILE = 0x04034b50;

function findEocd(view) {
  const minimum = Math.max(0, view.byteLength - 65557);
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD) return offset;
  }
  throw new Error("Invalid MXL/ZIP: end-of-central-directory record not found");
}
async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== "function") throw new Error("This browser cannot decompress deflated MXL files");
  let stream;
  try { stream = new DecompressionStream("deflate-raw"); }
  catch { throw new Error("This browser does not support raw DEFLATE required by this MXL file"); }
  const response = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await response.arrayBuffer());
}
async function extractEntry(bytes, view, entry) {
  const offset = entry.localHeaderOffset;
  if (view.getUint32(offset, true) !== LOCAL_FILE) throw new Error("Invalid MXL local file header");
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataStart = offset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > bytes.length) throw new Error("Truncated MXL entry");
  const compressed = bytes.slice(dataStart, dataEnd);
  if (entry.method === 0) return compressed;
  if (entry.method === 8) return inflateRaw(compressed);
  throw new Error(`Unsupported MXL compression method ${entry.method}`);
}

export async function extractMusicXmlFromMxl(arrayBuffer, options = {}) {
  const bytes = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
  if (bytes.length < 22) throw new Error("Invalid MXL/ZIP file");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(view);
  const entryCount = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  const maxEntries = Math.max(1, Number(options.maxEntries ?? 256));
  const maxUncompressedBytes = Math.max(1024, Number(options.maxUncompressedBytes ?? 32 * 1024 * 1024));
  if (entryCount > maxEntries) throw new Error("MXL contains too many ZIP entries");

  const decoder = new TextDecoder();
  const entries = [];
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== CENTRAL_FILE) throw new Error("Invalid MXL central directory");
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    if (flags & 0x1) throw new Error("Encrypted MXL files are not supported");
    if (uncompressedSize > maxUncompressedBytes) throw new Error("MXL entry exceeds the local safety limit");
    const nameStart = cursor + 46;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    entries.push({ name, flags, method, compressedSize, uncompressedSize, localHeaderOffset });
    cursor = nameStart + nameLength + extraLength + commentLength;
  }

  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const containerEntry = byName.get("META-INF/container.xml");
  let rootPath = null;
  if (containerEntry) {
    const containerText = decoder.decode(await extractEntry(bytes, view, containerEntry));
    rootPath = containerText.match(/<rootfile\b[^>]*\bfull-path\s*=\s*["']([^"']+)["']/i)?.[1] || null;
  }
  if (!rootPath) {
    rootPath = entries.map((entry) => entry.name).find((name) => /\.(musicxml|xml)$/i.test(name) && !/^META-INF\//i.test(name)) || null;
  }
  if (!rootPath || !byName.has(rootPath)) throw new Error("MXL does not contain a MusicXML root document");
  const xmlBytes = await extractEntry(bytes, view, byName.get(rootPath));
  if (xmlBytes.length > maxUncompressedBytes) throw new Error("MusicXML root exceeds the local safety limit");
  const xmlText = decoder.decode(xmlBytes);
  if (!/<score-(partwise|timewise)\b/i.test(xmlText)) throw new Error("MXL root document is not recognizable MusicXML");
  return Object.freeze({ version: MXL_IMPORT_VERSION, sourceFormat: "mxl", rootPath, xmlText, entryCount: entries.length });
}
