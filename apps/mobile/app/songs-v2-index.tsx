import { SongsListPage } from "@/components/songs-v2/ListPage"
import { useSongsV2Catalog } from "@/hooks/useSongsV2Catalog"

/**
 * All songs: the whole catalog as a playlist-style page (Spotify structure, our look): cover collage,
 * title and total time, download / sort / list menu, shuffle and a big Play, chips, song rows.
 * Opened from the Songs tab ("All"), from the Player ("Collection" row without a collection) and by
 * route. Play and Shuffle feed the player with this list ("Playing from All songs").
 */
export default function SongsV2IndexScreen() {
  const catalog = useSongsV2Catalog()
  return <SongsListPage listId="all" title="All songs" kind="all" entries={catalog.entries} loading={catalog.loading} error={Boolean(catalog.error)} onRetry={() => void catalog.reload()} />
}
