import { useMemo } from "react"

import { getUpcomingFestivals } from "@/data/festivals"
import type { SearchMenu } from "@/hooks/useSearchMenu"
import { useLanguage, useT } from "@/lib/i18n"
import { festivalText } from "@/lib/i18n/festivalText"
import { kirtanTypeLabel, type KirtanTypeId } from "@/lib/kirtan/types"
import { moodLabel } from "@/lib/kirtan/moods"
import { festivalNames, festivalSections, moodGroups, moodNames, typeTiles } from "@/lib/searchCards/browse"
import type { SearchCardsData } from "@/lib/searchCards/cards"
import { realCollectionEntries } from "@/lib/searchBrowse"
import { collectionHref, KIND_ORDER, kindLabel } from "@/lib/songsV2/collectionsIndex"

/** How many coming observances the Festivals page lists. */
const COMING = 6

/**
 * What the five cards of Search and the pages behind them are made of: the moods, the Kiirtan types, the festivals, the
 * collection kinds and the authors the app really holds right now. Nothing is made up: an empty list stays empty and the card
 * (or page) says so. The words follow the language.
 */
export function useSearchCardsData(menu: SearchMenu) {
  const t = useT()
  const language = useLanguage()
  const { stats } = menu
  return useMemo(() => {
    const entries = realCollectionEntries()
    const moods = moodGroups({
      psMoods: entries.filter((e) => e.kind === "mood").map((e) => ({ id: e.id, label: e.label, count: e.count, href: collectionHref(e) })),
      kiirtanMoods: stats.themes
        .filter((m) => m.confirmed > 0)
        .map((m) => ({ id: m.id, label: moodLabel(m.id), count: m.confirmed, href: `/browse-shelf?id=${encodeURIComponent(`theme:${m.id}`)}` })),
    })
    const types = typeTiles(stats.kiirtanTypes, (id) => kirtanTypeLabel(id as KirtanTypeId, "kiirtan"))
    const now = new Date()
    const festivals = festivalSections({
      coming: getUpcomingFestivals(now, COMING).map((item) => {
        const when = item.daysUntil === 0 ? t("fest.today") : item.daysUntil === 1 ? t("fest.tomorrow") : t("fest.inDays", { count: item.daysUntil })
        return { id: item.id, title: festivalText(item, language).title, line: `${item.dateLabel} · ${when}` }
      }),
      collections: entries.filter((e) => e.kind === "festival").map((e) => ({ id: e.id, label: e.label, count: e.count, countLabel: e.countLabel, href: collectionHref(e) })),
      setCount: stats.kiirtanSets,
    })
    // Collections: the kinds of list the app has, without the moods and festivals (those have their own cards)
    const collectionKinds = KIND_ORDER.filter((kind) => kind !== "mood" && kind !== "festival" && entries.some((e) => e.kind === kind)).map((kind) => kindLabel(kind, true))
    const authors = [...stats.authors].sort((a, b) => (b.listeners30 ?? 0) - (a.listeners30 ?? 0) || b.recordings - a.recordings || a.name.localeCompare(b.name)).map((a) => a.name)
    const cards: SearchCardsData = {
      mood: moodNames(moods),
      collections: collectionKinds,
      type: types.map((tile) => tile.label),
      authors,
      festivals: festivalNames(festivals),
    }
    return { moods, types, festivals, cards }
    // the words follow the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, t, language])
}
