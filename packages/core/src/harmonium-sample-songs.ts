import { parseSargamInput, sargamPlayEvents } from "./harmonium-keyboard"
import {
  westernToHz,
  type SheetLineInput,
  type SheetPlayEvent,
  type SheetTala,
} from "./notation-sheet"

export type HarmoniumSampleSongLine = {
  lyric: string
  lyricHi: string
  sargam: string
  /** Beat lengths for playback (kaharva). Display still uses `sargam`. */
  playBeats?: Array<{ sargam: string; beats: number; western?: string }>
}

export type HarmoniumSampleSong = {
  id: string
  title: string
  titleHi: string
  sourceUrl?: string
  sourceLabel?: string
  lines: HarmoniumSampleSongLine[]
}

export type HarmoniumPlayTempo = "slow" | "medium" | "fast"

export const HARMONIUM_BPM_MIN = 84
export const HARMONIUM_BPM_MAX = 240
export const HARMONIUM_BPM_DEFAULT = 100

export type HarmoniumPlayTiming = {
  bpm: number
  noteSec: number
  gapSec: number
  lineRestSec: number
  nearestPreset: HarmoniumPlayTempo | null
}

export const HARMONIUM_PLAY_TEMPOS: Record<
  HarmoniumPlayTempo,
  { id: HarmoniumPlayTempo; label: string; bpm: number }
> = {
  slow: { id: "slow", label: "Slow", bpm: 90 },
  medium: { id: "medium", label: "Medium", bpm: 100 },
  fast: { id: "fast", label: "Fast", bpm: 176 },
}

export const HARMONIUM_PLAY_TEMPO_ORDER: HarmoniumPlayTempo[] = ["slow", "medium", "fast"]

export function clampHarmoniumBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return HARMONIUM_BPM_DEFAULT
  return Math.round(Math.min(HARMONIUM_BPM_MAX, Math.max(HARMONIUM_BPM_MIN, bpm)))
}

export function sampleSongTiming(tempo: number | HarmoniumPlayTempo = HARMONIUM_BPM_DEFAULT): HarmoniumPlayTiming {
  const bpm = clampHarmoniumBpm(typeof tempo === "string" ? HARMONIUM_PLAY_TEMPOS[tempo].bpm : tempo)
  const beatSec = 60 / bpm
  const nearest = HARMONIUM_PLAY_TEMPO_ORDER.find((id) => HARMONIUM_PLAY_TEMPOS[id].bpm === bpm) ?? null
  return {
    bpm,
    noteSec: beatSec * 0.85,
    gapSec: Math.min(0.03, beatSec * 0.04),
    lineRestSec: beatSec * 1.5,
    nearestPreset: nearest,
  }
}

/** Booklet refrain (Prabhát Samgiita Roman sargam, Kaharba). á = hold. */
const BANDHU_REFRAIN = "Pa á á ma | Ga á á á | Sa Re á Ni | Sa á á á"
/** Booklet verse line for Álor / Ándhárer / Ghumer. */
const BANDHU_VERSE = "Sa Re Re á | Re Ga á Ga | ma Pa á ma | Ga á á á"
/** 16-matra kaharva cycle from the same booklet bars. */
const BANDHU_REFRAIN_BEATS = [
  { sargam: "P", beats: 3 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 4 },
  { sargam: "S", beats: 1 },
  { sargam: "R", beats: 2 },
  { sargam: ".N", beats: 1 },
  { sargam: "S", beats: 4 },
]
const BANDHU_VERSE_BEATS = [
  { sargam: "S", beats: 1 },
  { sargam: "R", beats: 3 },
  { sargam: "R", beats: 1 },
  { sargam: "G", beats: 3 },
  { sargam: "m", beats: 1 },
  { sargam: "P", beats: 2 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 4 },
]

function linePlayEvents(
  tonic: string,
  line: HarmoniumSampleSongLine,
  beatSec: number,
  gapSec: number,
  fallbackNoteSec: number,
): SheetPlayEvent[] {
  if (!line.playBeats?.length) {
    return sargamPlayEvents(tonic, line.sargam, fallbackNoteSec, gapSec)
  }
  const events: SheetPlayEvent[] = []
  let cursor = 0
  for (const { sargam, beats, western } of line.playBeats) {
    const fromWestern = western?.trim()
    const parsed = fromWestern
      ? {
          western: fromWestern,
          frequencyHz: westernToHz(fromWestern) ?? 0,
        }
      : parseSargamInput(sargam, tonic)[0]
    if (!parsed?.western || !parsed.frequencyHz) continue
    const span = beats * beatSec
    const isLast = events.length + 1 === (line.playBeats?.length ?? 0)
    events.push({
      western: parsed.western,
      frequencyHz: parsed.frequencyHz,
      startSec: cursor,
      durationSec: Math.max(0.16, isLast ? span + beatSec * 0.5 : span - gapSec),
    })
    cursor += span
  }
  return events
}

/**
 * PS 1 — Bandhu He Niye Calo (Jyotirgiita), kaharva.
 * Sargam text is copied from the Roman booklet bars (á = sustain).
 */
export const BANDHU_HE_NIYE_CALO_SONG: HarmoniumSampleSong = {
  id: "bandhu-he-niye-calo",
  title: "Bandhu He Niye Calo",
  titleHi: "বন্ধু হে নিয়ে চলো",
  sourceUrl: "https://sarkarverse.org/SARGAM/0001-1000/RS_0001-0025.pdf",
  sourceLabel: "Roman sargam · Prabhát Samgiita Part I",
  lines: [
    {
      lyric: "Bandhu he niye calo",
      lyricHi: "বন্ধু হে নিয়ে চলো",
      sargam: BANDHU_REFRAIN,
      playBeats: BANDHU_REFRAIN_BEATS,
    },
    {
      lyric: "Alor oi jharana dharara pane",
      lyricHi: "আলোর ওই ঝর্ণাধারার পানে",
      sargam: BANDHU_VERSE,
      playBeats: BANDHU_VERSE_BEATS,
    },
    {
      lyric: "Bandhu he niye calo",
      lyricHi: "বন্ধু হে নিয়ে চলো",
      sargam: BANDHU_REFRAIN,
      playBeats: BANDHU_REFRAIN_BEATS,
    },
    {
      lyric: "Andharer vyatha ar saye na prane",
      lyricHi: "আঁধারের ব্যথা আর সয় না প্রাণে",
      sargam: BANDHU_VERSE,
      playBeats: BANDHU_VERSE_BEATS,
    },
    {
      lyric: "Bandhu he niye calo",
      lyricHi: "বন্ধু হে নিয়ে চলো",
      sargam: BANDHU_REFRAIN,
      playBeats: BANDHU_REFRAIN_BEATS,
    },
    {
      lyric: "Ghumer ghor bhanganor gane gane",
      lyricHi: "ঘুমের ঘোর ভাঙানোর গানে গানে",
      sargam: BANDHU_VERSE,
      playBeats: BANDHU_VERSE_BEATS,
    },
    {
      lyric: "Bandhu he niye calo",
      lyricHi: "বন্ধু হে নিয়ে চলো",
      sargam: BANDHU_REFRAIN,
      playBeats: BANDHU_REFRAIN_BEATS,
    },
  ],
}

/** Only these songs have tested booklet sargam in the app. */
export const PUBLISHED_HARMONIUM_SONG_NUMBERS = [1, 2, 27] as const

export function isPublishedHarmoniumSong(songNumber: number): boolean {
  return (PUBLISHED_HARMONIUM_SONG_NUMBERS as readonly number[]).includes(songNumber)
}

export function bookletHarmoniumSong(songNumber: number): HarmoniumSampleSong | null {
  if (!isPublishedHarmoniumSong(songNumber)) return null
  return HARMONIUM_BOOKLET_SONGS[songNumber] ?? null
}

/** Learner-facing playable sargam: booklet copies, or an admin-submitted capture. */
export function hasPublishedLearnerSargam(
  songNumber: number,
  verificationStatus?: string | null,
  notationEnabled?: boolean | null,
): boolean {
  if (notationEnabled === false) return false
  if (bookletHarmoniumSong(songNumber)) return true
  return verificationStatus === "admin_submitted"
}

export const HARMONIUM_SAMPLE_SONGS = [BANDHU_HE_NIYE_CALO_SONG] as const

export function sampleSongSargam(song: HarmoniumSampleSong): string {
  return song.lines.map((line) => line.sargam).join("  ")
}

export function sampleSongPlayEvents(
  tonic: string,
  song: HarmoniumSampleSong = BANDHU_HE_NIYE_CALO_SONG,
  tempo: number | HarmoniumPlayTempo = HARMONIUM_BPM_DEFAULT,
): SheetPlayEvent[] {
  return sampleSongLineEvents(tonic, song, tempo).flatMap((line) => line.events)
}

export function sampleSongLineEvents(
  tonic: string,
  song: HarmoniumSampleSong = BANDHU_HE_NIYE_CALO_SONG,
  tempo: number | HarmoniumPlayTempo = HARMONIUM_BPM_DEFAULT,
): Array<{ line: HarmoniumSampleSongLine; events: SheetPlayEvent[]; startSec: number; endSec: number }> {
  const timing = sampleSongTiming(tempo)
  const beatSec = 60 / timing.bpm
  let cursor = 0
  return song.lines.map((line, index) => {
    const events = linePlayEvents(tonic, line, beatSec, timing.gapSec, timing.noteSec).map((event) => ({
      ...event,
      startSec: event.startSec + cursor,
    }))
    const startSec = cursor
    const last = events[events.length - 1]
    const endSec = last ? last.startSec + last.durationSec : cursor
    const isLastLine = index === song.lines.length - 1
    cursor = endSec + (isLastLine ? 0 : timing.lineRestSec)
    return { line, events, startSec, endSec }
  })
}

const HOLD_TOKENS = new Set(["-", "–", "—", ".", "।", "ऽ"])

/** Booklet-style names (PS Roman sargam): Sa Re Ga ma Pa Dha Ni. */
const BOOKLET_LATIN: Record<string, string> = {
  S: "Sa",
  r: "re",
  R: "Re",
  g: "ga",
  G: "Ga",
  m: "ma",
  M: "Ma",
  P: "Pa",
  d: "dha",
  D: "Dha",
  n: "ni",
  N: "Ni",
}

function playableSargamToken(sargam: string): string | null {
  const token = sargam.trim()
  if (!token || HOLD_TOKENS.has(token)) return null
  return token
}

function bookletLatinName(token: string, octave?: "lower" | "middle" | "upper"): string {
  const core = token.replace(/^\./, "").replace(/['′`]$/g, "")
  const latin = BOOKLET_LATIN[core] ?? core
  if (octave === "upper" || /['′`]/.test(token)) return `${latin}′`
  if (octave === "lower" || token.startsWith(".")) return `.${latin}`
  return latin
}

function collapsePlayBeats(
  beats: NonNullable<HarmoniumSampleSongLine["playBeats"]>,
): NonNullable<HarmoniumSampleSongLine["playBeats"]> {
  const collapsed: NonNullable<HarmoniumSampleSongLine["playBeats"]> = []
  for (const beat of beats) {
    const last = collapsed[collapsed.length - 1]
    if (last && last.sargam === beat.sargam && !last.western && !beat.western) {
      last.beats += beat.beats
    } else {
      collapsed.push({ ...beat })
    }
  }
  return collapsed
}

/** Compact S R G → Sa á Re | Ga ma like the Roman booklet. */
export function bookletSargamLine(
  beats: Array<{ sargam: string; beats: number }>,
  groupSize = 4,
): string {
  const parts: string[] = []
  let cycle = 0
  const group = Math.max(1, groupSize)
  for (const beat of beats) {
    const latin = bookletLatinName(beat.sargam)
    const count = Math.max(1, Math.round(beat.beats))
    if (cycle > 0 && cycle % group === 0) parts.push("|")
    parts.push(latin)
    for (let extra = 1; extra < count; extra += 1) parts.push("á")
    cycle += count
  }
  return parts.join(" ")
}

/** PS 2 from RS_0001-0025.pdf. One lyric phrase per sargam span (song 1). */
const E_GAN_R1 = "Sa Re Ga á | Ga Dha Pa á | Re á Ga á | Sa á Re á"
const E_GAN_DHARA = "Ni á Sa á | á á á á"
const E_GAN_UPALA = "Pa Dha Ga ma | Ga á á á"
const E_GAN_DINE = "Pa Dha Ga ma | Ga á á á"
const E_GAN_BAHE = "Pa á Dha Pa | á á á á"
const E_GAN_R4 = "Ga ma Pa Dha | Pa Pa Ga ma | Ga á á á | Re á Ga á"
const E_GAN_R5 = "Sa á Re á | Ni á Sa á | á á á á"
const E_GAN_R6 = "Sa Re Ga á | Ga Dha Pa á | Re á Ga Ga | Sa á Re Re"
const E_GAN_R7 = "Ni á Sa á | á á á á | Pa á Ga ma | Ga á á á"
const E_GAN_R8 = "Pa Pa Ga ma | Ga á á á | Pa á Dha Pa | á á á á"
const E_GAN_R9 = "Ga ma Pa Dha | Ga á á á | Re á Ga á | Sa á Re á"
const E_GAN_R10 = "Ni á Sa á | á á á á"
const E_GAN_R1_BEATS = [
  { sargam: "S", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "G", beats: 2 },
  { sargam: "G", beats: 1 },
  { sargam: "D", beats: 1 },
  { sargam: "P", beats: 2 },
  { sargam: "R", beats: 2 },
  { sargam: "G", beats: 2 },
  { sargam: "S", beats: 2 },
  { sargam: "R", beats: 2 },
]
const E_GAN_DHARA_BEATS = [
  { sargam: "N", beats: 2 },
  { sargam: "S", beats: 6 },
]
const E_GAN_UPALA_BEATS = [
  { sargam: "P", beats: 1 },
  { sargam: "D", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 4 },
]
const E_GAN_DINE_BEATS = [
  { sargam: "P", beats: 1 },
  { sargam: "D", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 4 },
]
const E_GAN_BAHE_BEATS = [
  { sargam: "P", beats: 2 },
  { sargam: "D", beats: 1 },
  { sargam: "P", beats: 5 },
]
const E_GAN_R4_BEATS = [
  { sargam: "G", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "D", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 4 },
  { sargam: "R", beats: 2 },
  { sargam: "G", beats: 2 },
]
const E_GAN_R5_BEATS = [
  { sargam: "S", beats: 2 },
  { sargam: "R", beats: 2 },
  { sargam: "N", beats: 2 },
  { sargam: "S", beats: 6 },
]
const E_GAN_R6_BEATS = [
  { sargam: "S", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "G", beats: 2 },
  { sargam: "G", beats: 1 },
  { sargam: "D", beats: 1 },
  { sargam: "P", beats: 2 },
  { sargam: "R", beats: 2 },
  { sargam: "G", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "S", beats: 2 },
  { sargam: "R", beats: 1 },
  { sargam: "R", beats: 1 },
]
const E_GAN_R7_BEATS = [
  { sargam: "N", beats: 2 },
  { sargam: "S", beats: 6 },
  { sargam: "P", beats: 2 },
  { sargam: "G", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 4 },
]
const E_GAN_R8_BEATS = [
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 4 },
  { sargam: "P", beats: 2 },
  { sargam: "D", beats: 1 },
  { sargam: "P", beats: 5 },
]
const E_GAN_R9_BEATS = [
  { sargam: "G", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "D", beats: 1 },
  { sargam: "G", beats: 4 },
  { sargam: "R", beats: 2 },
  { sargam: "G", beats: 2 },
  { sargam: "S", beats: 2 },
  { sargam: "R", beats: 2 },
]
const E_GAN_R10_BEATS = [
  { sargam: "N", beats: 2 },
  { sargam: "S", beats: 6 },
]

/**
 * PS 2 — E Gán Ámár Álor Jharńádhárá (Mukti Giiti).
 * Sargam rows are copied from RS_0001-0025.pdf (á = hold, | = kaharva bar).
 */
export const E_GAN_AMAR_ALOR_SONG: HarmoniumSampleSong = {
  id: "e-gan-amar-alor-jharnadhara",
  title: "E Gan Amar, Alor Jharana Dhara",
  titleHi: "এ গান আমার আলোর ঝর্ণাধারা",
  sourceUrl: "https://sarkarverse.org/SARGAM/0001-1000/RS_0001-0025.pdf",
  sourceLabel: "Roman sargam · Prabhát Samgiita Part I",
  lines: [
    {
      lyric: "E gan amar alor jharna",
      lyricHi: "এ গান আমার আলোর ঝর্ণা",
      sargam: E_GAN_R1,
      playBeats: E_GAN_R1_BEATS,
    },
    {
      lyric: "dhara",
      lyricHi: "ধারা",
      sargam: E_GAN_DHARA,
      playBeats: E_GAN_DHARA_BEATS,
    },
    {
      lyric: "Upala pathe",
      lyricHi: "উপল-পথে",
      sargam: E_GAN_UPALA,
      playBeats: E_GAN_UPALA_BEATS,
    },
    {
      lyric: "dine rate",
      lyricHi: "দিনে রাতে",
      sargam: E_GAN_DINE,
      playBeats: E_GAN_DINE_BEATS,
    },
    {
      lyric: "Bahe jai",
      lyricHi: "বহে যাই",
      sargam: E_GAN_BAHE,
      playBeats: E_GAN_BAHE_BEATS,
    },
    {
      lyric: "Bahe jai bandhanahara",
      lyricHi: "বহে যাই বাঁধনহারা",
      sargam: E_GAN_R4,
      playBeats: E_GAN_R4_BEATS,
    },
    {
      lyric: "Alor jharnadhara",
      lyricHi: "আলোর ঝর্ণাধারা",
      sargam: E_GAN_R5,
      playBeats: E_GAN_R5_BEATS,
    },
    {
      lyric: "E path amar bandhura kantakabhara",
      lyricHi: "এ পথ আমার বন্ধুর কণ্টকভরা",
      sargam: E_GAN_R6,
      playBeats: E_GAN_R6_BEATS,
    },
    {
      lyric: "Utsa hate pranera srote",
      lyricHi: "উৎস হতে প্রাণের স্রোতে",
      sargam: E_GAN_R7,
      playBeats: E_GAN_R7_BEATS,
    },
    {
      lyric: "Bheunge jai",
      lyricHi: "ভেঙ্গে যাই",
      sargam: E_GAN_R8,
      playBeats: E_GAN_R8_BEATS,
    },
    {
      lyric: "Bheunge jai pasanakara",
      lyricHi: "ভেঙ্গে যাই পাষাণকারা",
      sargam: E_GAN_R9,
      playBeats: E_GAN_R9_BEATS,
    },
    {
      lyric: "Alor jharnadhara",
      lyricHi: "আলোর ঝর্ণাধারা",
      sargam: E_GAN_R10,
      playBeats: E_GAN_R10_BEATS,
    },
  ],
}

/** PS 27 — Dáo Sáŕá Ogo Prabhu (Dadra). Cleanest page in RS_0026-0050.pdf. */
const DAO_OPEN = "Ga Pa Pa Pa | Pa Pa Pa Pa | Pa Dha Pa ma | Ga á á á"
const DAO_OPEN_B = "Re á Re Re | Re Re Ga ma | Re Ga Pa ma | Ga á á á"
const DAO_PRIYA = "Sa Sa Re Re | á á á Ga | Re Ga Ga Pa | ma á Ga á"
const DAO_NIDRA = "Pa á ma ma | Ga ma Re Ga | Sa Re Pa ma | Ga á Ga ma"
const DAO_ESO = "Pa á Pa Dha | Pa á Pa Dha | ma Dha Pa ma | Ga Re Ga ma"
const DAO_TIMIR = "Ga Pa Pa Pa | Pa Pa Pa Pa | ma Pa Dha Pa | ma Ga á á"
const DAO_MIHIR = "Ga Pa ma ma | Ga ma Re Ga | Sa Re Pa ma | Ga á á á"
const DAO_ALOR = "Ga Pa á Pa | Pa á Pa Pa | ma Pa Dha Pa | ma Ga á á"
const DAO_RANGA = "Ga Pa ma ma | Ga ma Re Ga | Sa Re Pa ma | Ga á Ga ma"
const DAO_MANE = "Pa Pa Pa Dha | Pa á á Dha | ma Dha Pa ma | Ga Re Ga ma"
const DAO_KUHE = "Sa Re Re Re | Re Re Ga ma | Re Ga Pa ma | Ga á Pa ma"
const DAO_OPEN_BEATS = [
  { sargam: "G", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "D", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 4 },
]
const DAO_OPEN_B_BEATS = [
  { sargam: "R", beats: 2 },
  { sargam: "R", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 4 },
]
const DAO_PRIYA_BEATS = [
  { sargam: "S", beats: 1 },
  { sargam: "S", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "R", beats: 4 },
  { sargam: "G", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "m", beats: 2 },
  { sargam: "G", beats: 2 },
]
const DAO_NIDRA_BEATS = [
  { sargam: "P", beats: 2 },
  { sargam: "m", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "S", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 2 },
  { sargam: "G", beats: 1 },
  { sargam: "m", beats: 1 },
]
const DAO_ESO_BEATS = [
  { sargam: "P", beats: 2 },
  { sargam: "P", beats: 1 },
  { sargam: "D", beats: 1 },
  { sargam: "P", beats: 2 },
  { sargam: "P", beats: 1 },
  { sargam: "D", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "D", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "m", beats: 1 },
]
const DAO_TIMIR_BEATS = [
  { sargam: "G", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "D", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 3 },
]
const DAO_MIHIR_BEATS = [
  { sargam: "G", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "S", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 4 },
]
const DAO_ALOR_BEATS = [
  { sargam: "G", beats: 1 },
  { sargam: "P", beats: 2 },
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 2 },
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "D", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 3 },
]
const DAO_RANGA_BEATS = [
  { sargam: "G", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "S", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 2 },
  { sargam: "G", beats: 1 },
  { sargam: "m", beats: 1 },
]
const DAO_MANE_BEATS = [
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "D", beats: 1 },
  { sargam: "P", beats: 3 },
  { sargam: "D", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "D", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "m", beats: 1 },
]
const DAO_KUHE_BEATS = [
  { sargam: "S", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "R", beats: 1 },
  { sargam: "G", beats: 1 },
  { sargam: "P", beats: 1 },
  { sargam: "m", beats: 1 },
  { sargam: "G", beats: 2 },
  { sargam: "P", beats: 1 },
  { sargam: "m", beats: 1 },
]

export const DAO_SARA_OGO_PRABHU_SONG: HarmoniumSampleSong = {
  id: "dao-sara-ogo-prabhu",
  title: "Dao Sara Ogo Prabhu Chande Gane",
  titleHi: "দাও সাড়া ওগো প্রভু ছন্দে গানে",
  sourceUrl: "https://sarkarverse.org/SARGAM/0001-1000/RS_0026-0050.pdf",
  sourceLabel: "Roman sargam · Prabhát Samgiita Part II",
  lines: [
    {
      lyric: "Dao sara ogo Prabhu chande gane",
      lyricHi: "দাও সাড়া ওগো প্রভু ছন্দে গানে",
      sargam: DAO_OPEN,
      playBeats: DAO_OPEN_BEATS,
    },
    {
      lyric: "Dao sara ogo Prabhu nrtye tale",
      lyricHi: "দাও সাড়া ওগো প্রভু নৃত্যে তালে",
      sargam: DAO_OPEN_B,
      playBeats: DAO_OPEN_B_BEATS,
    },
    {
      lyric: "Ogo priyatama debata amar",
      lyricHi: "ওগো প্রিয়তম দেবতা আমার",
      sargam: DAO_PRIYA,
      playBeats: DAO_PRIYA_BEATS,
    },
    {
      lyric: "Nidra yakhan tumi nije bhangale",
      lyricHi: "নিদ্রা যখন তুমি নিজে ভাঙ্গালে",
      sargam: DAO_NIDRA,
      playBeats: DAO_NIDRA_BEATS,
    },
    {
      lyric: "Eso nrtye tale, eso nrtye tale",
      lyricHi: "এসো নৃত্যে তালে, এসো নৃত্যে তালে",
      sargam: DAO_ESO,
      playBeats: DAO_ESO_BEATS,
    },
    {
      lyric: "Timir jagate ami chinu acetan",
      lyricHi: "তিমির জগতে আমি ছিনু অচেতন",
      sargam: DAO_TIMIR,
      playBeats: DAO_TIMIR_BEATS,
    },
    {
      lyric: "Mihir jiibane mor asile nutan",
      lyricHi: "মিহির জীবনে মোর আসিলে নূতন",
      sargam: DAO_MIHIR,
      playBeats: DAO_MIHIR_BEATS,
    },
    {
      lyric: "Alor chatay tumi e kii karile",
      lyricHi: "আলোর ছটায় তুমি এ কী করিলে",
      sargam: DAO_ALOR,
      playBeats: DAO_ALOR_BEATS,
    },
    {
      lyric: "Amar jiiban man raunge rangale",
      lyricHi: "আমার জীবন মন রঙে রাঙালে",
      sargam: DAO_RANGA,
      playBeats: DAO_RANGA_BEATS,
    },
    {
      lyric: "Eso nrtye tale, eso nrtye tale",
      lyricHi: "এসো নৃত্যে তালে, এসো নৃত্যে তালে",
      sargam: DAO_ESO,
      playBeats: DAO_ESO_BEATS,
    },
    {
      lyric: "Tumi mane matale, mane matale",
      lyricHi: "তুমি মনে মাতালে, মনে মাতালে",
      sargam: DAO_MANE,
      playBeats: DAO_MANE_BEATS,
    },
    {
      lyric: "Eso nrtye tale, eso nrtye tale",
      lyricHi: "এসো নৃত্যে তালে, এসো নৃত্যে তালে",
      sargam: DAO_ESO,
      playBeats: DAO_ESO_BEATS,
    },
    {
      lyric: "Sab kuhelika bhedi marme ele",
      lyricHi: "সব কুহেলিকা ভেদি মর্মে এলে",
      sargam: DAO_KUHE,
      playBeats: DAO_KUHE_BEATS,
    },
    {
      lyric: "Eso nrtye tale, eso nrtye tale",
      lyricHi: "এসো নৃত্যে তালে, এসো নৃত্যে তালে",
      sargam: DAO_ESO,
      playBeats: DAO_ESO_BEATS,
    },
  ],
}

export const HARMONIUM_BOOKLET_SONGS: Record<number, HarmoniumSampleSong> = {
  1: BANDHU_HE_NIYE_CALO_SONG,
  2: E_GAN_AMAR_ALOR_SONG,
  27: DAO_SARA_OGO_PRABHU_SONG,
}

/** Turn stored song notation into the keyboard player's song shape. */
export function notationToHarmoniumSong(
  lines: SheetLineInput[],
  options: {
    id: string
    title: string
    titleHi?: string
    sourceUrl?: string | null
    sourceLabel?: string
    songLyricLines?: string[]
    originalLyricLines?: string[]
    tala?: SheetTala | null
  },
): HarmoniumSampleSong | null {
  if (!lines.length) return null
  const songLines: HarmoniumSampleSongLine[] = []
  for (const [index, line] of lines.entries()) {
    const playBeats: NonNullable<HarmoniumSampleSongLine["playBeats"]> = []
    for (const measure of line.measures) {
      for (const beat of measure.beats) {
        for (const note of beat.notes) {
          const token = playableSargamToken(note.sargam)
          if (!token) continue
          const octave = note.octave
          const named =
            octave === "lower" ? `.${token}` : octave === "upper" ? `${token}'` : token
          playBeats.push({ sargam: named, beats: Math.max(0.25, note.duration || 1) })
        }
      }
    }
    if (!playBeats.length) continue
    const collapsed = collapsePlayBeats(playBeats)
    songLines.push({
      lyric: options.songLyricLines?.[index]?.trim() || line.lyrics.trim() || `Line ${index + 1}`,
      lyricHi: options.originalLyricLines?.[index]?.trim() || "",
      sargam: bookletSargamLine(collapsed, 4),
      playBeats: collapsed,
    })
  }
  if (!songLines.length) return null
  return {
    id: options.id,
    title: options.title,
    titleHi: options.titleHi ?? "",
    sourceUrl: options.sourceUrl ?? undefined,
    sourceLabel: options.sourceLabel,
    lines: songLines,
  }
}
