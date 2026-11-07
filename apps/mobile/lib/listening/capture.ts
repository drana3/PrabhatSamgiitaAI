import type { MockSong } from "@/data/mock"
import { makeEntry, type HistoryEntry } from "@/lib/listening/history"

/**
 * Turns the track the player has now into a history entry, and a track into the id the play counter follows.
 * A Prabhat Samgiita song is `ps:<number>`, a recording is `rec:<app id>` (the history needs both, unlike the author
 * statistics, which only count server recordings). Pure.
 */

type TrackLike = Pick<MockSong, "number" | "title" | "performer" | "kind" | "kiirtan">

/** The id the counter follows for a track; null when nothing plays. */
export function trackKey(song: Pick<MockSong, "number" | "kind" | "kiirtan"> | null | undefined): string | null {
  if (!song) return null
  if (song.kind === "kiirtan" && song.kiirtan?.id) return `rec:${song.kiirtan.id}`
  if (Number.isFinite(song.number) && song.number > 0) return `ps:${song.number}`
  return null
}

/** What the catalog knows about a recording beyond the player's track (kind id and language are not on the track). */
export type RecordingFacts = { kind?: string; language?: string | null; author?: string; title?: string } | null

export function entryFromTrack(song: TrackLike, at: number, facts: RecordingFacts): HistoryEntry | null {
  const key = trackKey(song)
  if (!key) return null
  if (key.startsWith("rec:")) {
    const itemId = key.slice(4)
    return makeEntry({
      ref: "rec",
      itemId,
      title: facts?.title || song.title,
      kind: facts?.kind || song.kiirtan?.recording || "kiirtan",
      author: facts?.author ?? song.performer,
      ...(facts?.language ? { language: facts.language } : {}),
      at,
    })
  }
  return makeEntry({ ref: "ps", itemId: String(song.number), title: song.title, kind: "prabhat_samgiita", at })
}
