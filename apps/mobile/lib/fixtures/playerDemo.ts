import type { MockSong } from "@/data/mock"
import { fixtureSeconds } from "@/lib/fixtures/songs"
import type { Instrument, PlayerVersion } from "@/lib/playerV2/versions"

/**
 * TODO(api): demo content for the web preview (EXPO_PUBLIC_MOCKUP_DATA=1), copied from the Claude
 * design prototype (public/mockup/Main.dc.html: `_songs`, `_content`, `_recs`, the opening state).
 * It lets the Player look exactly like the boards without audio or an API. Nothing here runs when
 * the flag is off. Delete with lib/playerV2/demoEngine.ts when the catalog sends this data.
 */

export const DEMO_CATALOG_COUNT = 5018
/** The prototype opens on PS 3 at 1:12, paused. */
export const DEMO_START_NUMBER = 3
export const DEMO_START_POSITION = 72
/** The prototype moves the karaoke highlight to the next line every 7 seconds and loops. */
export const DEMO_LINE_SECONDS = 7
export const DEMO_SAVED_NUMBERS = [1, 3]
export const DEMO_PLAYLISTS: Array<{ id: string; name: string; songs: number[] }> = [
  { id: "demo-pl-0", name: "Morning meditation", songs: [1, 3, 5] },
  { id: "demo-pl-1", name: "Evening kirtan", songs: [2, 4, 6, 7] },
]

export type DemoRow = { number: number; title: string; seconds: number }

const REAL_TITLES: Array<[string, number]> = [
  ["Bandhu He Niye Calo", 238],
  ["E Gán Ámár, Álor Jharańá Dhárá", 252],
  ["Ándhára Sheśe Álora Deshe", 271],
  ["Sakal Maner Viińá Ek Sure Báje Áj", 305],
  ["Elo, Anek Juger Sei Ajáná Pathik", 226],
  ["Bandhu Ámár", 300],
  ["Niiravatá Májhe Ke Go Tumi Ele", 284],
]
const A1 = ["Ánanda", "Madhur", "Prem", "Áloke", "Sándhya", "Prabháte", "Sháran", "Bhakti", "Niilá", "Sudhá", "Manera", "Dhyáner", "Karuńá", "Jyotir", "Sargam", "Támasii"]
const A2 = ["Dháráy", "Gán", "Sure", "Pathe", "Vináy", "Tarańge", "Nikuñje", "Smaran", "Mantre", "Amiyá", "Sparshe", "Bandaná"]

let rows: DemoRow[] | null = null

/** The prototype's 64 songs: PS 1 to 7 are the catalog's, the other 57 are its invented sample titles. */
export function demoRows(): DemoRow[] {
  if (rows) return rows
  const out: DemoRow[] = REAL_TITLES.map(([title, seconds], i) => ({ number: i + 1, title, seconds }))
  for (let i = 7; i < 64; i += 1) {
    out.push({
      number: Math.round(7 + (i - 6) * (5011 / 57)),
      title: `${A1[i % 16]} ${A2[(i * 5) % 12]}${i % 3 === 0 ? " Áj" : ""}`,
      seconds: 180 + ((i * 53) % 170),
    })
  }
  rows = out
  return out
}

export function demoNumbers(): number[] {
  return demoRows().map((row) => row.number)
}

export function demoRow(number: number): DemoRow | undefined {
  return demoRows().find((row) => row.number === number)
}

export function demoTitle(number: number): string | undefined {
  return demoRow(number)?.title
}

export function demoSeconds(number: number): number {
  return demoRow(number)?.seconds ?? fixtureSeconds(number)
}

type Word = [roman: string, devanagari: string]
type Content = { lines: Word[][]; en: string[] }

const CONTENT_A: Content = {
  lines: [
    [["Bandhu", "बन्धु"], ["he", "हे"], ["niye", "निये"], ["calo", "चलो"]],
    [["Álor", "आलोर"], ["jharańá", "झरना"], ["dháráy", "धाराय"], ["dhuiye", "धुइये"], ["dáo", "दाओ"]],
    [["Tomár", "तोमार"], ["kole", "कोले"], ["ámáy", "आमाय"], ["tule", "तुले"], ["náo", "नाओ"]],
    [["Andhakár", "अन्धकार"], ["kete", "केटे"], ["yáy", "याय"]],
  ],
  en: ["Friend, take me along.", "Wash me in the flowing stream of light.", "Lift me into your lap.", "Let the darkness be cut away."],
}
const CONTENT_B: Content = {
  lines: [
    [["Ándhára", "अन्धार"], ["sheśe", "शेषे"], ["álora", "आलोर"], ["deshe", "देशे"]],
    [["Tumi", "तुमि"], ["eso", "एसो"], ["háte", "हाते"], ["dhare", "धरे"]],
    [["Ámár", "आमार"], ["pathe", "पथे"], ["álo", "आलो"], ["jválo", "ज्वालो"]],
  ],
  en: ["At the end of the dark, in the land of light.", "You come, holding my hand.", "Kindle a light on my path."],
}

/** The prototype's `_content(i)` by row index: row 0 is sample A, row 2 is sample B, then odd rows B and even rows A. */
function contentFor(number: number): Content {
  const found = demoRows().findIndex((row) => row.number === number)
  const index = found >= 0 ? found : Math.max(0, number - 1)
  if (index === 0) return CONTENT_A
  if (index === 2) return CONTENT_B
  return index % 2 ? CONTENT_B : CONTENT_A
}

const RECORDINGS: Array<{ instrument: Instrument; label: string; who: string; tag: NonNullable<PlayerVersion["tag"]>; delta: number }> = [
  { instrument: "voice", label: "Voice", who: "Performer A", tag: "Best", delta: 0 },
  { instrument: "guitar", label: "Guitar", who: "Performer B", tag: "Verified", delta: 22 },
  { instrument: "harmonium", label: "Harmonium", who: "Performer C", tag: "Verified", delta: -18 },
  { instrument: "group", label: "Kirtan group", who: "Group D", tag: "Verified", delta: 42 },
  { instrument: "guitar", label: "Guitar", who: "Performer E", tag: "Community", delta: 9 },
  { instrument: "harmonium", label: "Harmonium, solo", who: "Performer F", tag: "Instrumental", delta: -30 },
]

const DEMO_SCHEME = "demo://"

export function demoUrl(number: number, version: number): string {
  return `${DEMO_SCHEME}ps-${number}/v${version}`
}

export function isDemoUrl(url: string | null | undefined): boolean {
  return (url ?? "").startsWith(DEMO_SCHEME)
}

/** 0-based version index inside a demo url, or -1. */
export function demoVersionIndex(url: string | null | undefined): number {
  const match = /\/v(\d+)$/.exec(url ?? "")
  return isDemoUrl(url) && match ? Number(match[1]) - 1 : -1
}

export function demoVersions(number: number): PlayerVersion[] {
  const base = demoSeconds(number)
  return RECORDINGS.map((rec, index) => ({
    id: `ps-${number}-v${index + 1}`,
    songNumber: number,
    instrument: rec.instrument,
    label: rec.label,
    performer: rec.who,
    lengthSeconds: base + rec.delta,
    bytes: null,
    url: demoUrl(number, index + 1),
    tag: rec.tag,
    offlineAllowed: true,
  }))
}

/** Length of one version of a demo song (the prototype adds a fixed offset per version). */
export function demoVersionSeconds(number: number, versionIndex: number): number {
  return demoSeconds(number) + (RECORDINGS[versionIndex]?.delta ?? 0)
}

/** A full song for the player: lyrics, Devanagari, English lines and six versions. */
export function demoSong(number: number, fallbackTitle?: string, versionIndex = 0): MockSong {
  const content = contentFor(number)
  const index = Math.min(Math.max(versionIndex, 0), RECORDINGS.length - 1)
  const audioUrl = demoUrl(number, index + 1)
  return {
    id: `ps-${number}`,
    number,
    title: demoTitle(number) ?? fallbackTitle ?? `Prabhat Samgiita ${number}`,
    shortDescription: "",
    imageUrl: "",
    thumbnailUrl: "",
    themes: [],
    meaning: content.en.join(" "),
    lyrics: content.lines.map((line) => line.map((w) => w[0]).join(" ")).join("\n"),
    lyricsDevanagari: content.lines.map((line) => line.map((w) => w[1]).join(" ")).join("\n"),
    transliteration: null,
    translation: content.en.join("\n"),
    durationSeconds: demoVersionSeconds(number, index),
    performer: RECORDINGS[index]!.who,
    videos: [],
    audioUrl,
    audioRecordings: RECORDINGS.map((rec, i) => ({
      title: `${rec.label} · ${rec.who}`,
      url: demoUrl(number, i + 1),
      provider: "demo",
    })),
    mediaHydrated: true,
  }
}
