import { demoKirtanById } from "@/lib/fixtures/searchMenuDemo"
import { t } from "@/lib/i18n"
import { kirtanById } from "@/lib/kirtan/catalog"
import { playQueue } from "@/lib/kirtan/mixPlayback"
import { kiirtanNumber, registerKiirtans } from "@/lib/kirtan/track"
import type { HistoryEntry } from "@/lib/listening/history"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * Plays a history entry again in the one player: a Prabhat Samgiita song by its number, a recording by its id (if it is
 * still in the library). Returns the message to show when it cannot play (gone from the library, or the player's own
 * refusal); null when it started. The preview also knows its sample discourses.
 */
export function playHistoryEntry(entry: HistoryEntry): string | null {
  const source = { id: "history", name: t("history.title") }
  if (entry.ref === "ps") {
    const number = Number(entry.itemId)
    if (!Number.isFinite(number)) return t("history.gone")
    return playQueue([number], source, number) || null
  }
  const k = kirtanById(entry.itemId) ?? (MOCKUP_DATA ? demoKirtanById(entry.itemId) : null)
  if (!k || k.status !== "published") return t("history.gone")
  registerKiirtans([k])
  const number = kiirtanNumber(k.id)
  return playQueue([number], source, number) || null
}
