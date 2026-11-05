import { useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { LibraryRow, type LibraryRowData } from "@/components/learn-v2/LearnBlocks"
import { Chip, OverlayScreen } from "@/components/learn-v2/ui"
import { Reveal } from "@/components/today/motion"
import { SAMPLE_LEARN_WORDS } from "@/data/learnWords"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useLearnHydrated } from "@/hooks/useLearnHydrated"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import {
  LIBRARY_FILTERS,
  buildLibraryRows,
  filterLibraryRows,
  libraryEmptyText,
  type LibraryFilter,
} from "@/lib/learn/library"
import { LEARN_ROUTES, songHref, songPathHref, wordsHref } from "@/lib/learn/routes"
import { useLearnStore } from "@/stores/learnStore"
import { href } from "@/utils/href"

/**
 * "See all" of the Learn hub: every song on the learner's list with the filters All / Due /
 * Learning / Learned. This is the old "My songs" tab, moved here unchanged.
 */
export default function LearnSongsScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const hydrated = useLearnHydrated()
  const now = useMemo(() => Date.now(), [])
  const cards = useLearnStore((s) => s.cards)
  const songs = useLearnStore((s) => s.songs)
  const paths = useLearnStore((s) => s.paths)
  const [filter, setFilter] = useState<LibraryFilter>("all")

  const go = (path: string) => router.push(href(path))
  const back = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href(LEARN_ROUTES.learn))
  }

  const rows = useMemo(
    () => buildLibraryRows({ songs, paths, cards, words: SAMPLE_LEARN_WORDS, now, mockup: MOCKUP_DATA }),
    [songs, paths, cards, now],
  )
  const shown = useMemo(() => filterLibraryRows(rows, filter), [rows, filter])

  const openRow = (row: LibraryRowData) => go(songHref(`ps-${row.number}`))
  const rowCta = (row: LibraryRowData) => (row.learned ? go(wordsHref()) : go(songPathHref(`ps-${row.number}`)))

  return (
    <OverlayScreen theme={theme} onBack={back} label="My songs">
      {!hydrated ? null : (
        <Reveal index={0}>
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Show">
            {LIBRARY_FILTERS.map((item) => (
              <Chip key={item.key} theme={theme} small green label={item.label} on={filter === item.key} onPress={() => setFilter(item.key)} />
            ))}
          </View>
          <View style={styles.list}>
            {shown.map((row) => (
              <LibraryRow key={row.number} theme={theme} row={row} onOpen={() => openRow(row)} onCta={() => rowCta(row)} />
            ))}
            {shown.length === 0 ? (
              <Text style={[styles.empty, { color: theme.textBody }]}>{libraryEmptyText(rows.length, filter)}</Text>
            ) : null}
          </View>
        </Reveal>
      )}
    </OverlayScreen>
  )
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 6, paddingBottom: 4 },
  list: { gap: 10, marginTop: 6 },
  empty: { fontFamily: "Roboto_500Medium", fontSize: 16, lineHeight: 23, paddingHorizontal: 10, maxWidth: 300 },
})
