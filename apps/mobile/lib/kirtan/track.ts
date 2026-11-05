import type { MockSong } from "@/data/mock"

/**
 * A Kiirtan as a normal track of the one player.
 *
 * The player's queue is a list of numbers (the engine, the saved-playlist session, the lock screen
 * all work on numbers). A Prabhat Samgiita song is its catalog number (1 to 5018). A Kiirtan gets a
 * synthetic number far above the catalog, derived from its id, so both kinds live in ONE queue with
 * one engine and one UI. The number is stable across launches (a hash of the id, probed on the rare
 * clash), so a saved queue still points at the same Kiirtan.
 * Pure: no React, no stores, no I/O.
 */

/** First synthetic number. The catalog ends at 5018, so everything from here on is a Kiirtan. */
export const KIIRTAN_NUMBER_BASE = 1_000_000_000
const KIIRTAN_NUMBER_SPAN = 900_000_000

export type TrackKind = "song" | "kiirtan"

/** What the player needs to know about a Kiirtan. The catalog type `Kirtan` has all of these. */
export type KiirtanSource = {
  id: string
  title: string
  /** performer or group, as the author wrote it */
  author: string
  durationSec: number | null
  type: string
  thumbnailUrl: string | null
  /** the audio file the author uploaded; null while the upload API does not exist (preview data) */
  audioUrl: string | null
  /** display name of the person who added it */
  addedBy: string
}

const numberById = new Map<string, number>()
const idByNumber = new Map<number, string>()
/** The track record of every Kiirtan converted so far, by queue number (next, previous and track end look here). */
const songByNumber = new Map<number, MockSong>()

function hashOf(text: string): number {
  // FNV-1a, 32 bit
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/** The synthetic queue number of a Kiirtan id. The same id always gives the same number. */
export function kiirtanNumber(id: string): number {
  const known = numberById.get(id)
  if (known != null) return known
  let n = KIIRTAN_NUMBER_BASE + (hashOf(id) % KIIRTAN_NUMBER_SPAN)
  while (idByNumber.has(n) && idByNumber.get(n) !== id) n = KIIRTAN_NUMBER_BASE + ((n - KIIRTAN_NUMBER_BASE + 1) % KIIRTAN_NUMBER_SPAN)
  numberById.set(id, n)
  idByNumber.set(n, id)
  return n
}

/** Is this queue number a Kiirtan (and not a catalog song)? */
export function isKiirtanNumber(n: number): boolean {
  return Number.isFinite(n) && n >= KIIRTAN_NUMBER_BASE
}

export function trackKindOfNumber(n: number): TrackKind {
  return isKiirtanNumber(n) ? "kiirtan" : "song"
}

/** The Kiirtan id behind a queue number, if that number was ever handed out in this session. */
export function kiirtanIdForNumber(n: number): string | null {
  return idByNumber.get(n) ?? null
}

export function isKiirtanSong(song: Pick<MockSong, "kind"> | null | undefined): boolean {
  return song?.kind === "kiirtan"
}

/** A Kiirtan as the player's track record (no lyrics, no versions, one audio file). */
export function kiirtanToSong(k: KiirtanSource): MockSong {
  const number = kiirtanNumber(k.id)
  const song = buildKiirtanSong(k, number)
  songByNumber.set(number, song)
  return song
}

/** The track record for a queue number, if that Kiirtan was registered; null for songs and unknown numbers. */
export function kiirtanSongForNumber(n: number): MockSong | null {
  return songByNumber.get(n) ?? null
}

function buildKiirtanSong(k: KiirtanSource, number: number): MockSong {
  return {
    id: `kiirtan-${k.id}`,
    number,
    title: k.title,
    shortDescription: "",
    imageUrl: k.thumbnailUrl ?? "",
    thumbnailUrl: k.thumbnailUrl ?? "",
    themes: [],
    meaning: "",
    lyrics: "",
    translation: "",
    durationSeconds: k.durationSec ?? 0,
    performer: k.author,
    videos: [],
    audioUrl: k.audioUrl,
    // The uploaded file is the only recording; a missing file stays missing (the engine reports it).
    mediaHydrated: true,
    kind: "kiirtan",
    kiirtan: { id: k.id, type: k.type, addedBy: k.addedBy },
  }
}

/** Hands out numbers for a whole list at once (so later lookups by number work). */
export function registerKiirtans(list: readonly KiirtanSource[]): number[] {
  return list.map((k) => kiirtanToSong(k).number)
}

/** Does this queue number have an audio file to play? Songs are decided elsewhere; this answers for Kiirtans. */
export function kiirtanHasAudio(n: number): boolean {
  return Boolean(songByNumber.get(n)?.audioUrl?.trim())
}

/** `Kiirtan · added by Priya`, or just `Kiirtan` when nobody is named. */
export function kiirtanByline(addedBy: string | null | undefined): string {
  const who = (addedBy ?? "").trim()
  return who ? `Kiirtan · added by ${who}` : "Kiirtan"
}

/** Tag text of a queue or list row. */
export function trackTag(n: number): "PS" | "KIIRTAN" {
  return isKiirtanNumber(n) ? "KIIRTAN" : "PS"
}

/** `PS 12` or `KIIRTAN`: the label of a queue row. */
export function trackLabel(n: number): string {
  return isKiirtanNumber(n) ? "KIIRTAN" : `PS ${n}`
}
