import { useMemo } from "react"
import { useLocalSearchParams } from "expo-router"

import { SongsListPage } from "@/components/songs-v2/ListPage"
import { useSongsV2Catalog } from "@/hooks/useSongsV2Catalog"
import { withFixtureStats } from "@/lib/fixtures/songs"
import { songNumbersForCategory } from "@/lib/categorySongs"
import { placeholderEntry } from "@/lib/songsV2/entry"
import { useT } from "@/lib/i18n"
import { psSongNumbers } from "@/lib/psCollections/data"
import { isPsKey } from "@/lib/psCollections/parse"
import { moodOf } from "@/lib/psCollections/sections"

/**
 * One collection as a playlist-style page, the same layout as All songs with the collection's own
 * accent on the cover. `id` is anything songNumbersForCategory understands: a category id, a
 * collection label or a collection value.
 */
export default function SongsV2CollectionScreen() {
  const t = useT()
  const { id, title } = useLocalSearchParams<{ id?: string; title?: string }>()
  const catalog = useSongsV2Catalog()
  const key = String(id ?? "")
  const heading = String(title ?? id ?? t("songs.coll.fallbackTitle"))

  // "ps:<file>:<id>" is one of the Prabhat Samgiita collections (lib/psCollections); anything else is a category or a site collection
  const numbers = useMemo(() => (!key ? [] : isPsKey(key) ? (psSongNumbers(key) ?? []) : songNumbersForCategory(key)), [key])
  const coverSeed = isPsKey(key) ? key : `site:${key}`
  const entries = useMemo(
    () => numbers.map((n) => catalog.byNumber.get(n) ?? withFixtureStats(placeholderEntry(n))),
    [numbers, catalog.byNumber],
  )

  return (
    <SongsListPage
      listId={`collection:${key}`}
      title={heading}
      kind="collection"
      coverSeed={coverSeed}
      coverMood={moodOf(heading)}
      entries={entries}
      loading={catalog.loading && !entries.length}
      error={Boolean(catalog.error)}
      onRetry={() => void catalog.reload()}
      emptyText={t("songs.coll.noSongs")}
    />
  )
}
