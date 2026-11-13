import type { MockSong } from "@/data/mock"
import { demoVersions, isDemoUrl } from "@/lib/fixtures/playerDemo"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/** Spec API-09: one playable version of a song. */
export type Instrument = "voice" | "guitar" | "harmonium" | "group" | "instrumental"

export type PlayerVersion = {
  id: string
  songNumber: number
  instrument: Instrument
  /** Display name when the generic instrument word is not enough ("Kirtan group"). */
  label?: string
  performer: string
  /** Seconds. Null until the file or the API tells us (never a placeholder). */
  lengthSeconds: number | null
  bytes: number | null
  url: string
  tag: "Best" | "Verified" | "Community" | "Instrumental" | null
  offlineAllowed: boolean
}

type SongVersionSource = Pick<MockSong, "number" | "audioUrl" | "audioRecordings"> & Partial<Pick<MockSong, "kind">>

const GENERIC_TITLE = /^(?:audio|recording|track)?\s*\d*$/i

const INSTRUMENT_WORDS: Array<[Instrument, RegExp]> = [
  ["harmonium", /harmonium|harmonuim|harmoniam/i],
  ["guitar", /guitar|gitar/i],
  ["group", /kii?rtan|group|choir|chorus|sangha|samgha|ensemble/i],
  ["instrumental", /instrumental|karaoke|flute|sitar|tabla|piano|orchestra/i],
]

export function inferInstrument(title: string | null | undefined): Instrument {
  const text = (title ?? "").trim()
  for (const [instrument, pattern] of INSTRUMENT_WORDS) {
    if (pattern.test(text)) return instrument
  }
  return "voice"
}

const INSTRUMENT_LABEL: Record<Instrument, string> = {
  voice: "Voice",
  guitar: "Guitar",
  harmonium: "Harmonium",
  group: "Group",
  instrumental: "Instrumental",
}

export function instrumentLabel(instrument: Instrument): string {
  return INSTRUMENT_LABEL[instrument]
}

function performerFor(title: string | null | undefined, index: number): string {
  const text = (title ?? "").trim()
  if (!text || GENERIC_TITLE.test(text)) return index === 0 ? "Original recording" : `Recording ${index + 1}`
  return text
}

/**
 * Versions of the current song, built from what the catalog gives us today
 * (`audioUrl` plus `audioRecordings`). When API-09 lands, only this function
 * changes; every screen reads `PlayerVersion[]`.
 */
export function versionsFromSong(song: SongVersionSource): PlayerVersion[] {
  // A Kiirtan is one uploaded file: no versions, no version chip, no "all versions" mode.
  if (song.kind === "kiirtan") return []
  // Web preview with prototype data: the six sample versions of the design.
  if (MOCKUP_DATA && isDemoUrl(song.audioUrl)) return demoVersions(song.number)
  const seen = new Set<string>()
  const rows: Array<{ title: string; url: string; performer?: string }> = []
  const push = (title: string, url: string | null | undefined, performer?: string) => {
    const clean = (url ?? "").trim()
    if (!clean || seen.has(clean)) return
    seen.add(clean)
    rows.push({ title, url: clean, ...(performer?.trim() ? { performer: performer.trim() } : {}) })
  }
  for (const item of song.audioRecordings ?? []) push(item.title, item.url, item.performer)
  // The playing URL may be an offline copy or not in the list: keep it reachable.
  if (!rows.length) push("", song.audioUrl)

  return rows.map((row, index) => {
    const instrument = inferInstrument(row.title)
    return {
      id: `ps-${song.number}-v${index + 1}`,
      songNumber: song.number,
      instrument,
      // a colleague's recording names its singer; the archive's own files are named by their title
      performer: row.performer ?? performerFor(row.title, index),
      lengthSeconds: null,
      bytes: null,
      url: row.url,
      tag: instrument === "instrumental" ? "Instrumental" : null,
      offlineAllowed: true,
    }
  })
}

/**
 * Index of the version that is playing. The playing URL decides when it names one of the versions:
 * a remembered choice must not label version 3 while the player is on version 1. A remembered
 * choice (by version id) only stands in when the URL names none of them, for instance when `audioUrl`
 * is a local file because the song is offline.
 */
export function selectedVersionIndex(
  versions: PlayerVersion[],
  audioUrl: string | null | undefined,
  rememberedId?: string | null,
): number {
  if (!versions.length) return -1
  const url = (audioUrl ?? "").trim()
  const byUrl = url ? versions.findIndex((v) => v.url === url) : -1
  if (byUrl >= 0) return byUrl
  if (rememberedId) {
    const byId = versions.findIndex((v) => v.id === rememberedId)
    if (byId >= 0) return byId
  }
  return 0
}

/** `Voice · Performer A` (the chip text after the PS number). */
export function versionSummary(version: PlayerVersion): string {
  return `${version.label ?? instrumentLabel(version.instrument)} · ${version.performer}`
}

/** Row sub line in the Versions sheet: `Instrument · length · tag`. */
export function versionRowMeta(version: PlayerVersion, formatLength: (s: number) => string): string {
  const parts: string[] = [version.label ?? instrumentLabel(version.instrument)]
  if (version.lengthSeconds != null) parts.push(formatLength(version.lengthSeconds))
  if (version.tag) parts.push(version.tag)
  return parts.join(" · ")
}
