import type { MockSong } from "@/data/mock"
import { fixtureSeconds } from "@/lib/fixtures/songs"
import { previewTitle, previewTitleOrNumber } from "@/lib/previewCatalog"
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
  { id: "demo-pl-1", name: "Evening kiirtan", songs: [2, 4, 6, 7] },
]

export type DemoRow = { number: number; title: string; seconds: number }

/** The opening queue of the demo player: PS 1 to 64, real songs. The catalog has 5,018. */
export const DEMO_QUEUE_SIZE = 64

/**
 * The opening queue as rows. Numbers are the catalog's own, titles come from the loaded catalog
 * (lib/previewCatalog.ts; "Prabhat Samgiita N" until it has loaded), lengths are the fixture
 * values of lib/fixtures/songs.ts. TODO(api): real lengths.
 */
export function demoRows(): DemoRow[] {
  return Array.from({ length: DEMO_QUEUE_SIZE }, (_, i) => demoRow(i + 1)!)
}

export function demoNumbers(): number[] {
  return Array.from({ length: DEMO_QUEUE_SIZE }, (_, i) => i + 1)
}

export function demoRow(number: number): DemoRow | undefined {
  if (!Number.isInteger(number) || number < 1 || number > DEMO_CATALOG_COUNT) return undefined
  return { number, title: previewTitleOrNumber(number), seconds: fixtureSeconds(number) }
}

export function demoTitle(number: number): string | undefined {
  return previewTitle(number)
}

export function demoSeconds(number: number): number {
  return fixtureSeconds(number)
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
  const index = Math.max(0, number - 1)
  if (index === 0) return CONTENT_A
  if (index === 2) return CONTENT_B
  return index % 2 ? CONTENT_B : CONTENT_A
}

const RECORDINGS: Array<{ instrument: Instrument; label: string; who: string; tag: NonNullable<PlayerVersion["tag"]>; delta: number }> = [
  { instrument: "voice", label: "Voice", who: "Performer A", tag: "Best", delta: 0 },
  { instrument: "guitar", label: "Guitar", who: "Performer B", tag: "Verified", delta: 22 },
  { instrument: "harmonium", label: "Harmonium", who: "Performer C", tag: "Verified", delta: -18 },
  { instrument: "group", label: "Kiirtan group", who: "Group D", tag: "Verified", delta: 42 },
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
