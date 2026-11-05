import { useMemo } from "react"
import { useLocalSearchParams } from "expo-router"

import { SongsListPage } from "@/components/songs-v2/ListPage"
import { useSongsV2Catalog } from "@/hooks/useSongsV2Catalog"
import { withFixtureStats } from "@/lib/fixtures/songs"
import { songNumbersForCategory } from "@/lib/categorySongs"
import { placeholderEntry } from "@/lib/songsV2/entry"

/**
 * One collection as a playlist-style page, the same layout as All songs with the collection's own
 * accent on the cover. `id` is anything songNumbersForCategory understands: a category id, a
 * collection label or a collection value.
 */
export default function SongsV2CollectionScreen() {
  const { id, title } = useLocalSearchParams<{ id?: string; title?: string }>()
  const catalog = useSongsV2Catalog()
  const key = String(id ?? "")
  const heading = String(title ?? id ?? "Collection")

  const numbers = useMemo(() => (!key ? [] : songNumbersForCategory(key)), [key])
  const entries = useMemo(
    () => numbers.map((n) => catalog.byNumber.get(n) ?? withFixtureStats(placeholderEntry(n))),
    [numbers, catalog.byNumber],
  )

  return (
    <SongsListPage
      listId={`collection:${key}`}
      title={heading}
      kind="collection"
      entries={entries}
      loading={catalog.loading && !entries.length}
      emptyText="No songs in this collection yet."
    />
  )
}
