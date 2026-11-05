import { songPlayback, type PlayerPlaybackSlice } from "@/lib/playback"
import { demoVersionIndex } from "@/lib/fixtures/playerDemo"
import { formatLength, type SongVersion } from "@/lib/songPage/versions"

/**
 * Plain logic of the song page's hero, action row and versions list (no React): which song and which
 * version the unified player is on, how the versions are listed, and the lines of text under the title.
 */

type PlayerSlice = PlayerPlaybackSlice & {
  currentSong: (PlayerPlaybackSlice["currentSong"] & { audioUrl?: string | null }) | null
}

export type NowPlaying = {
  /** The player's current song is this song (paused or playing). */
  isCurrent: boolean
  /** Pause icon: this song is current and playing (buffering counts). */
  showPause: boolean
  buffering: boolean
  /** Index in the list the versions were given in, -1 when this song is not the current one. */
  versionIndex: number
}

/**
 * Index of the version the player has loaded. The demo player names its versions in the URL
 * (`demo://ps-3/v2`); a real song matches by URL; a local offline copy (not in the list) falls back to the
 * first version, like the full player does.
 */
export function playingVersionIndex(versions: readonly Pick<SongVersion, "url">[], audioUrl: string | null | undefined): number {
  if (!versions.length) return -1
  const demo = demoVersionIndex(audioUrl)
  if (demo >= 0) return demo < versions.length ? demo : 0
  const url = (audioUrl ?? "").trim()
  const byUrl = url ? versions.findIndex((v) => v.url === url) : -1
  return byUrl >= 0 ? byUrl : 0
}

/** What the unified player says about THIS song: current, playing, and which version. */
export function nowPlaying(
  state: PlayerSlice,
  song: { id: string; number: number },
  versions: readonly Pick<SongVersion, "url">[],
): NowPlaying {
  const base = songPlayback(state, song)
  return {
    isCurrent: base.isCurrent,
    showPause: base.showPause,
    buffering: base.isBuffering,
    versionIndex: base.isCurrent ? playingVersionIndex(versions, state.currentSong?.audioUrl) : -1,
  }
}

const TAG_RANK: Record<NonNullable<SongVersion["tag"]> | "none", number> = {
  Best: 0,
  Verified: 1,
  none: 2,
  Community: 3,
  Instrumental: 4,
}

/**
 * Order of the "Other versions" list: Best first, then Verified, untagged, Community, Instrumental; the
 * catalog's own order inside each group. It never depends on what is playing, so rows do not jump
 * when the version changes. Returns the indexes into the given list (the page keeps using its own indexes).
 */
export function versionOrder(versions: readonly Pick<SongVersion, "tag">[]): number[] {
  return versions
    .map((v, index) => ({ index, rank: TAG_RANK[v.tag ?? "none"] }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((row) => row.index)
}

/** `PS 1 · Prabhat Samgiita` */
export function psLine(number: number): string {
  return `PS ${number} · Prabhat Samgiita`
}

const SCRIPT_NAME: Record<string, string> = { roman: "Roman", devanagari: "Devanagari", bengali: "Bengali" }

/** The catalog's language label when it names a language (not just a script), else the scripts the lyrics exist in. */
export function languageParts(language: string | null | undefined, scripts: readonly string[]): string[] {
  const label = (language ?? "").trim()
  if (label && !/^(roman|latin|transliteration)$/i.test(label)) {
    return label.split(/[\/,&]| and /i).map((part) => part.trim()).filter(Boolean)
  }
  return scripts.map((id) => SCRIPT_NAME[id] ?? id)
}

/** `3:42 · 6 versions · Hindi/Bengali`; a part with no data is left out. */
export function metaLine(input: { seconds: number | null; versionCount: number; languages: readonly string[] }): string {
  const parts: string[] = []
  const length = formatLength(input.seconds)
  if (length) parts.push(length)
  if (input.versionCount > 0) parts.push(`${input.versionCount} ${input.versionCount === 1 ? "version" : "versions"}`)
  if (input.languages.length) parts.push(input.languages.join("/"))
  return parts.join(" · ")
}

export type CreditRow = { role: string; name: string }

/**
 * Words, music and performer. Every Prabhat Samgiita song is words and music by Shrii P. R. Sarkar
 * (Shrii Shrii Anandamurti), so those two lines are the same for all; the performer is the version's.
 */
export function creditRows(performer: string | null | undefined): CreditRow[] {
  const rows: CreditRow[] = [
    { role: "Words", name: "Shrii P. R. Sarkar" },
    { role: "Music", name: "Shrii P. R. Sarkar" },
  ]
  const who = (performer ?? "").trim()
  if (who) rows.push({ role: "Performer", name: who })
  return rows
}

/** The first non-empty lines of the lyrics for the preview card. */
export function previewLines(lines: readonly string[], count = 4): string[] {
  return lines.map((line) => line.trim()).filter(Boolean).slice(0, count)
}

