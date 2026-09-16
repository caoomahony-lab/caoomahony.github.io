import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = path.resolve(process.argv[2] || ".");
const port = Number(process.argv[3] || 5173);
const types = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".xml":"application/xml", ".musicxml":"application/vnd.recordare.musicxml+xml", ".wav":"audio/wav", ".md":"text/markdown" };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const file = path.normalize(path.join(base, requested));
  if (!file.startsWith(base)) { res.writeHead(403).end("Forbidden"); return; }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404).end("Not found"); return; }
    res.setHeader("Content-Type", types[path.extname(file).toLowerCase()] || "application/octet-stream");
    fs.createReadStream(file).pipe(res);
  });
});
server.listen(port, () => console.log(`Serving ${base} at http://localhost:${port}`));
