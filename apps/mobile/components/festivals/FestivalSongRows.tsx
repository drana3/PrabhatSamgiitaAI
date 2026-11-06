import { useCallback } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { TodaySongPill } from "@/components/today/TodayBlocks"
import type { MockSong } from "@/data/mock"
import type { FestivalSongLink } from "@/data/festivalSongs"
import type { AmProto } from "@/constants/tokens/amToday"
import { useSongsV2Catalog } from "@/hooks/useSongsV2Catalog"
import { useT } from "@/lib/i18n"
import { songPlayback } from "@/lib/playback"
import { readableTitle } from "@/lib/readableTitle"
import { songSummaryToMockSong } from "@/lib/songMap"
import { usePlayerStore } from "@/stores/playerStore"
import { href } from "@/utils/href"
import collectionSongTitles from "../../../../data/generated/collection_song_titles.json"

const BUNDLED_TITLES = collectionSongTitles as Record<string, { title?: string; first_line?: string | null }>

/**
 * Title, open and play for the songs a festival lists. The title is the catalogue's when it is loaded, else the
 * one saved with the collections, else "Prabhat Samgiita 12": a title is never made up.
 */
export function useFestivalSongActions() {
  const router = useRouter()
  const t = useT()
  const catalog = useSongsV2Catalog()

  const titleOf = useCallback(
    (number: number): string => {
      const fromCatalog = catalog.byNumber.get(number)?.title
      const bundled = BUNDLED_TITLES[String(number)]
      const raw = fromCatalog || bundled?.title || bundled?.first_line || ""
      return raw.trim() ? readableTitle(raw) : t("festSongs.untitled", { number })
    },
    [catalog.byNumber, t],
  )

  const open = useCallback((number: number) => router.push(href(`/song-v2/ps-${number}`)), [router])

  /** Plays the song with the rest of the shown list as the queue, and opens the player (the same as Today's "listen"). */
  const play = useCallback(
    (number: number, queue: number[]) => {
      const song: MockSong = songSummaryToMockSong({ number, title: titleOf(number), first_line: titleOf(number), is_verified: true })
      const wasPlaying = songPlayback(usePlayerStore.getState(), song).showPause
      usePlayerStore.getState().playOrToggle(song, queue)
      if (!wasPlaying) router.navigate(href("/player-v2"))
    },
    [router, titleOf],
  )

  return { titleOf, open, play }
}

/** Why the song is on the list: "Bábá Birthday Songs" (its list), "Chosen for this day" or "Composed on this day, 1982". */
export function useSongBasisLine() {
  const t = useT()
  return useCallback(
    (link: FestivalSongLink): string => {
      if (link.basis === "composed") return t("festSongs.row.composed", { year: String(link.year) })
      return link.list ? t("festSongs.row.list", { list: link.list }) : t("festSongs.row.chosen")
    },
    [t],
  )
}

/**
 * Songs of a festival as Today's song rows: tap the row to open the song, the round button to play it.
 */
export function FestivalSongRows({ p, songs }: { p: AmProto; songs: readonly FestivalSongLink[] }) {
  const { titleOf, open, play } = useFestivalSongActions()
  const basisLine = useSongBasisLine()
  const queue = songs.map((s) => s.number)
  return (
    <View style={styles.list}>
      {songs.map((link) => (
        <TodaySongPill
          key={link.number}
          p={p}
          meta={`PS ${link.number}`}
          title={titleOf(link.number)}
          firstLine={basisLine(link)}
          onOpen={() => open(link.number)}
          onPlay={() => play(link.number, queue)}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({ list: { gap: 8 } })
