#!/usr/bin/env node
// Generates the computer-voice clips of the pronunciation memo (macOS only: uses `say` and ffmpeg).
//   node scripts/pronunciation/generate-clips.mjs          make the clips that are missing
//   node scripts/pronunciation/generate-clips.mjs --force  make all again
// Each sample word of every rule is read from its SCRIPT spelling (Bengali script by the bn_IN voice Piya, Devanagari
// by the hi_IN voice Lekha: there is no Sanskrit voice) and written to assets/audio/pronunciation/computer/<audio id>.m4a.
// Then run build-audio-index.mjs. See docs/pronunciation.md.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { appRoot, loadPronunciationData } from "./load-data.mjs"

const VOICES = { bengali: "Piya", sanskrit: "Lekha" }
const RATE = "90" // words per minute: slower than the default, so single words are clear
const force = process.argv.includes("--force")

const { ALL_RULES } = await loadPronunciationData()
const outDir = join(appRoot, "assets", "audio", "pronunciation", "computer")
mkdirSync(outDir, { recursive: true })
const tmp = mkdtempSync(join(tmpdir(), "pron-clips-"))
const manifest = []
let made = 0

for (const rule of ALL_RULES) {
  for (const sample of rule.samples) {
    const out = join(outDir, `${sample.audio}.m4a`)
    const voice = VOICES[rule.language]
    manifest.push({ audio: sample.audio, voice, text: sample.script, roman: sample.roman })
    if (!force && existsSync(out)) continue
    const aiff = join(tmp, `${sample.audio}.aiff`)
    execFileSync("say", ["-v", voice, "-r", RATE, "-o", aiff, sample.script])
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error", "-i", aiff,
      // trim leading silence, then trailing silence (by reversing), and keep a short tail so the word does not end abruptly.
      // Only the two ends are cut: stop_periods would also cut at a quiet gap inside the word.
      "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,apad=pad_dur=0.08",
      "-ac", "1", "-ar", "22050", "-c:a", "aac", "-b:a", "32k", out,
    ])
    made++
  }
}
rmSync(tmp, { recursive: true, force: true })
writeFileSync(join(outDir, "manifest.json"), JSON.stringify({ generator: "scripts/pronunciation/generate-clips.mjs", voices: VOICES, rate: RATE, clips: manifest }, null, 2) + "\n")
let bytes = 0
for (const c of manifest) bytes += statSync(join(outDir, `${c.audio}.m4a`)).size
console.log(`clips: ${manifest.length} (made now: ${made}), total ${(bytes / 1024).toFixed(0)} KB`)
