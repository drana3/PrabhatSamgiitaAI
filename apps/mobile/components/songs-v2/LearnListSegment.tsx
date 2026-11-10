import { StyleSheet, View } from "react-native"

import { EmptyNote, SectionHeading } from "@/components/songs-v2/primitives"
import { SongCardRow } from "@/components/songs-v2/SongCardRow"
import { SongsReveal } from "@/components/songs-v2/SongsReveal"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import type { CatalogEntry } from "@/lib/songsV2/entry"
import { stackGap } from "@/lib/songsV2/rowStyles"
import { useListViewStore } from "@/stores/listViewStore"
import { useT } from "@/lib/i18n"

type Props = {
  theme: SongsTheme
  /** "learning" or "learned": the heading and the empty words differ */
  which: "learning" | "learned"
  entries: CatalogEntry[]
  savedSet: ReadonlySet<number>
  offlineNumbers: ReadonlySet<number>
  onOpen: (entry: CatalogEntry) => void
  onToggleSave: (entry: CatalogEntry) => void
  onQueue: (entry: CatalogEntry) => void
  onMenu: (entry: CatalogEntry) => void
}

/** The Learning and Learned chips of Songs: the songs of the person's Learn progress (lib/learn/learnChips.ts), as the same rows as Saved. */
export function LearnListSegment({ theme, which, entries, savedSet, offlineNumbers, onOpen, onToggleSave, onQueue, onMenu }: Props) {
  const t = useT()
  const rowStyle = useListViewStore((s) => s.rowStyle)
  return (
    <View style={[styles.sect, { paddingTop: 28 }]}>
      <SongsReveal index={3} style={styles.pad10}>
        <SectionHeading
          theme={theme}
          first={which === "learning" ? t("songs.chip.learning") : t("songs.chip.learned")}
          second={t("songs.count", { count: entries.length })}
        />
      </SongsReveal>
      {entries.length ? (
        <SongsReveal index={4} style={styles.list}>
          <View style={{ gap: stackGap(rowStyle) }}>
            {entries.map((entry) => (
              <SongCardRow
                key={entry.number}
                theme={theme}
                entry={entry}
                saved={savedSet.has(entry.number)}
                offline={offlineNumbers.has(entry.number)}
                onOpen={onOpen}
                onToggleSave={onToggleSave}
                onQueue={onQueue}
                onMenu={onMenu}
              />
            ))}
          </View>
        </SongsReveal>
      ) : (
        <EmptyNote theme={theme}>{which === "learning" ? t("songs.learning.empty") : t("songs.learned.empty")}</EmptyNote>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  sect: { paddingTop: 40, gap: 20 },
  pad10: { paddingHorizontal: 10 },
  list: { paddingHorizontal: 10, gap: 10 },
})
