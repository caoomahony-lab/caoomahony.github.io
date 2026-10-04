import { generateDemoWav, generateVoiceLeadingWav } from "./generate-demo-wav.mjs";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
await Promise.all([
  generateDemoWav(path.join(root, "public/tracks/demo.wav")),
  generateVoiceLeadingWav(path.join(root, "public/tracks/chromatic-voice-leading.wav"))
]);
const dist = path.join(root, "dist");
await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });

for (const entry of ["index.html", "src", "public", "observable", "README.md", "WORK_START_HERE.md"]) {
  await fs.cp(path.join(root, entry), path.join(dist, entry), { recursive: true });
}
console.log("Built static ES-module distribution in dist/");
