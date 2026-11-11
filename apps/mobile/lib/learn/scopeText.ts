import { t } from "@/lib/i18n"
import { PS_SONG_COUNT } from "@/lib/learn/learnSongs"
import type { ScopeSummary } from "@/lib/learn/scope"

/** The plain line over the cards and the quiz: "Deck: 3 songs, 42 words". */
export function deckLine(summary: ScopeSummary): string {
  const words = t("learn.scope.words", { count: summary.words })
  if (summary.mode === "all") return t("learn.scope.deck.all", { words })
  if (summary.songs === 0) return t("learn.scope.deck.none")
  return t("learn.scope.deck", { songs: t("songs.count", { count: summary.songs }), words })
}

/** "Word meanings so far: 4 of 9 songs." when some of the songs have none yet; null when all have them. */
export function partialLine(summary: ScopeSummary): string | null {
  const total = summary.mode === "all" ? PS_SONG_COUNT : summary.songs
  if (total === 0 || summary.songsWithWords >= total) return null
  return t("learn.scope.partial", { have: summary.songsWithWords, count: total })
}

/** Why the deck is empty: no song chosen at all, or songs without word meanings. */
export function emptyKind(summary: ScopeSummary): "none" | "nowords" | null {
  if (summary.words > 0) return null
  return summary.mode !== "all" && summary.songs === 0 ? "none" : "nowords"
}
