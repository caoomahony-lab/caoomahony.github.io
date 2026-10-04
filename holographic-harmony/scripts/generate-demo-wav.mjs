import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEMO_NOTES = [
  ["B",0,4],["C",1,5],["D",1,5],["E",1,5],
  ["F",1,5],["G",1,5],["A",1,5],["B",0,5],
  ["B",0,4],["F",1,4],["C",1,5],["G",1,4],
  ["D",0,5],["B",0,4],["A",0,4],["F",1,4],
  ["E",0,5],["C",1,5],["C",0,5],["B",0,4],
  ["G",0,4],["D",0,5],["E",0,5],["C",0,5],
  ["C",0,5],["E",0,5],["G",0,5],["A",0,5],
  ["D",0,5],["G",0,4],["C",0,5],["C",0,5]
];

const VOICE_LEADING_CHORDS = [
  [["F",1,4],["A",1,4],["C",1,5]],
  [["G",-1,4],["B",-1,4],["E",-1,5]],
  [["F",0,4],["B",-1,4],["D",0,5]],
  [["F",1,4],["B",0,4],["D",0,5]],
  [["F",1,4],["B",0,4],["D",1,5]],
  [["F",1,4],["G",1,4],["C",1,5]],
  [["F",1,4],["A",0,4],["C",1,5]],
  [["F",1,4],["A",1,4],["C",1,5]]
];

const STEP_PC = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };

function writeAscii(buffer, offset, text) { buffer.write(text, offset, "ascii"); }

function midiFor(step, alter, octave) {
  return 12 * (octave + 1) + ((STEP_PC[step] + alter) % 12 + 12) % 12;
}

function wavFromUnsigned8BitData(data, sampleRate) {
  const wav = Buffer.alloc(44 + data.length);
  writeAscii(wav, 0, "RIFF");
  wav.writeUInt32LE(36 + data.length, 4);
  writeAscii(wav, 8, "WAVE");
  writeAscii(wav, 12, "fmt ");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  writeAscii(wav, 36, "data");
  wav.writeUInt32LE(data.length, 40);
  data.copy(wav, 44);
  return wav;
}

export async function generateDemoWav(outputPath = path.resolve("public/tracks/demo.wav")) {
  const sampleRate = 8000;
  const secondsPerNote = 0.5;
  const sampleCount = Math.round(DEMO_NOTES.length * secondsPerNote * sampleRate);
  const data = Buffer.alloc(sampleCount);
  let cursor = 0;

  for (const [step, alter, octave] of DEMO_NOTES) {
    const midi = midiFor(step, alter, octave);
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const n = Math.round(secondsPerNote * sampleRate);
    for (let i = 0; i < n; i += 1) {
      const t = i / sampleRate;
      const attack = Math.min(1, t / 0.015);
      const release = Math.min(1, Math.max(0, (secondsPerNote - t) / 0.05));
      const envelope = attack * release * Math.exp(-1.35 * t);
      const x = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.65;
      data[cursor++] = Math.max(0, Math.min(255, Math.round(128 + x * 110)));
    }
  }

  const wav = wavFromUnsigned8BitData(data, sampleRate);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, wav);
  return outputPath;
}

export async function generateVoiceLeadingWav(outputPath = path.resolve("public/tracks/chromatic-voice-leading.wav")) {
  const sampleRate = 8000;
  const secondsPerChord = 2;
  const sampleCount = Math.round(VOICE_LEADING_CHORDS.length * secondsPerChord * sampleRate);
  const data = Buffer.alloc(sampleCount);
  let cursor = 0;

  for (const chord of VOICE_LEADING_CHORDS) {
    const frequencies = chord.map(([step, alter, octave]) => {
      const midi = midiFor(step, alter, octave);
      return 440 * 2 ** ((midi - 69) / 12);
    });
    const n = Math.round(secondsPerChord * sampleRate);
    for (let i = 0; i < n; i += 1) {
      const t = i / sampleRate;
      const attack = Math.min(1, t / 0.025);
      const release = Math.min(1, Math.max(0, (secondsPerChord - t) / 0.12));
      const envelope = attack * release * (0.82 + 0.18 * Math.exp(-0.8 * t));
      const mixed = frequencies.reduce((sum, frequency, voice) => {
        const weight = voice === 0 ? 1 : 0.86;
        return sum + weight * Math.sin(2 * Math.PI * frequency * t);
      }, 0) / 2.72;
      const x = mixed * envelope * 0.78;
      data[cursor++] = Math.max(0, Math.min(255, Math.round(128 + x * 110)));
    }
  }

  const wav = wavFromUnsigned8BitData(data, sampleRate);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, wav);
  return outputPath;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const demo = await generateDemoWav();
  const progression = await generateVoiceLeadingWav();
  console.log("Generated " + demo);
  console.log("Generated " + progression);
}
