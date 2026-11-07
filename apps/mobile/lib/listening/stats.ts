import { MENU_RULES } from "@/lib/searchMenu/config"
import type { ListenerStats } from "@/lib/searchMenu/types"
import { artistKey, splitAuthors } from "@/lib/kirtan/artists"
import type { HistoryEntry } from "@/lib/listening/history"

const DAY = 24 * 60 * 60 * 1000

/**
 * What the local listening log says about THIS listener, in the shape the Search menu rules read (`ListenerStats`):
 * counted plays per author and per Bhajan language inside the personal window (60 days), and how many different
 * recordings the plays of an author were spread over. It never leaves the phone and is empty while the log is
 * empty or paused for good. A joint author ("A & B") counts for both names, like everywhere else.
 */
export function listenerStatsFromHistory(entries: readonly HistoryEntry[], now: number): ListenerStats {
  const since = now - MENU_RULES.windowDays.personal * DAY
  const authors: Record<string, { plays: number; distinct: Set<string> }> = {}
  const languages: Record<string, number> = {}
  for (const e of entries) {
    if (e.at < since || e.at > now) continue
    if (e.ref === "rec") {
      for (const name of splitAuthors(e.author)) {
        const key = artistKey(name)
        const a = (authors[key] ??= { plays: 0, distinct: new Set() })
        a.plays++
        a.distinct.add(e.itemKey)
      }
      if (e.kind === "bhajan" && e.language) languages[e.language] = (languages[e.language] ?? 0) + 1
    }
  }
  return {
    authors: Object.fromEntries(Object.entries(authors).map(([k, v]) => [k, { plays: v.plays, distinct: v.distinct.size }])),
    languages,
  }
}
