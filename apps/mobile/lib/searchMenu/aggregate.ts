import { MENU_RULES } from "@/lib/searchMenu/config"
import type { AuthorStat, MenuRecording, MenuStats } from "@/lib/searchMenu/types"
import { artistKey, splitAuthors } from "@/lib/kirtan/artists"

/**
 * Turns the recordings the app already holds into the counts the rules read. Nothing is guessed:
 * a field the recording does not have is not counted, and `played.source` is "none" until a recording
 * carries a play count from the server.
 */

const DAY = 24 * 60 * 60 * 1000
/** Old server rows with the removed fourth kind read as a Bhajan (lib/kirtan/kind.ts normalizeKind). */
const LEGACY: Readonly<Record<string, string>> = { devotional_song: "bhajan" }

export function normalizeKindId(kind: string): string {
  return LEGACY[kind] ?? kind
}

function bump(map: Record<string, number>, key: string, by = 1) {
  map[key] = (map[key] ?? 0) + by
}

/**
 * `psCollections`, `themes`, `listener`, `pins` and `memory` do not come from recordings, so the caller
 * passes them in `extra`.
 */
export function aggregateRecordings(
  recordings: readonly MenuRecording[],
  now: number,
  extra: Pick<MenuStats, "psCollections"> & Partial<Pick<MenuStats, "themes" | "listener" | "pins" | "memory">>,
): MenuStats {
  const kiirtanTypes: Record<string, number> = {}
  const kiirtanStyles: Record<string, number> = {}
  const moodCounts: Record<string, number> = {}
  let babaAudio = 0
  const bhajanTypes: Record<string, number> = {}
  const bhajanLanguages: Record<string, number> = {}
  const sets = new Map<string, number>()
  const authors = new Map<string, AuthorStat>()
  let psRecordings = 0
  let spiritualSongs = 0
  let newInWindow = 0
  let withPlays = 0
  let totalPlays = 0
  let anyPlayField = false
  const since = now - MENU_RULES.windowDays.new * DAY

  for (const r of recordings) {
    const kind = normalizeKindId(r.kind)
    if (r.createdAt >= since && r.createdAt <= now) newInWindow++
    if (typeof r.plays === "number") {
      anyPlayField = true
      if (r.plays > 0) { withPlays++; totalPlays += r.plays }
    }
    for (const mood of r.moods ?? []) bump(moodCounts, mood)
    if (kind === "baba_audio") babaAudio++
    if (kind === "kiirtan") {
      bump(kiirtanTypes, r.type || "other")
      if (r.style) bump(kiirtanStyles, r.style)
      if (r.collectionId) sets.set(r.collectionId, (sets.get(r.collectionId) ?? 0) + 1)
      for (const name of splitAuthors(r.author)) {
        const key = artistKey(name)
        const a = authors.get(key) ?? { key, name, recordings: 0 }
        a.recordings++
        authors.set(key, a)
      }
    } else if (kind === "bhajan") {
      bump(bhajanTypes, r.type || "other")
      if (r.language) bump(bhajanLanguages, r.language)
    } else if (kind === "spiritual_song") spiritualSongs++
    else if (kind === "prabhat_samgiita") psRecordings++
  }

  return {
    now,
    psCollections: extra.psCollections,
    psRecordings,
    kiirtanTypes,
    kiirtanStyles,
    babaAudio,
    kiirtanSets: [...sets.values()].filter((n) => n >= 2).length,
    bhajanLanguages,
    bhajanTypes,
    spiritualSongs,
    authors: [...authors.values()],
    newInWindow,
    // lifetime counter of the recordings table; the 30-day window arrives with the daily counts (play_daily)
    played: { source: anyPlayField ? "lifetime" : "none", recordingsWithPlays: withPlays, totalPlays },
    themes: extra.themes ?? Object.entries(moodCounts).map(([id, confirmed]) => ({ id, confirmed })),
    listener: extra.listener,
    pins: extra.pins,
    memory: extra.memory,
  }
}
