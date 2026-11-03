import { useCallback, useEffect, useRef, useState } from "react"
import { FlatList, ScrollView, StyleSheet, Text, View, type ViewToken } from "react-native"
import { ChevronDown, ChevronRight, ListFilter, Play } from "lucide-react-native"

import { FastScrollRail } from "@/components/songs-v2/FastScrollRail"
import { Chip, Token } from "@/components/songs-v2/Pill"
import { Press } from "@/components/songs-v2/Press"
import { SongCardRow } from "@/components/songs-v2/SongCardRow"
import { songCategories } from "@/constants/categories"
import type { CatalogController } from "@/hooks/useCatalogController"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amGap, amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { collectionCount } from "@/data/collections"
import { listPerfProps } from "@/lib/listPerf"
import { allCollectionsLabel } from "@/lib/songsV2/collections"
import type { CatalogEntry } from "@/lib/songsV2/entry"
import { removeToken } from "@/lib/songsV2/filters"
import { railVisible } from "@/lib/songsV2/rail"
import { sortOption, type ListRow } from "@/lib/songsV2/sort"

const STRIP_HEIGHT = 54

type Props = {
  theme: AmTheme
  controller: CatalogController
  entries: CatalogEntry[]
  loading: boolean
  error: string | null
  onReload: () => void
  savedNumbers: ReadonlySet<number>
  offlineNumbers: ReadonlySet<number>
  bottomPadding: number
  onOpen: (entry: CatalogEntry) => void
  onToggleSave: (entry: CatalogEntry) => void
  onQueue: (entry: CatalogEntry) => void
  onPlayAll: (numbers: number[]) => void
  onOpenIndex: () => void
}

/**
 * Catalog segment (spec SCR-11 item 4 to 6 and SCR-30): one-line chip strip
 * pinned under the header, a list bar with sort, filters and Play all, the
 * song list, and the fast-scroll rail.
 */
export function CatalogSegment({
  theme,
  controller,
  entries,
  loading,
  error,
  onReload,
  savedNumbers,
  offlineNumbers,
  bottomPadding,
  onOpen,
  onToggleSave,
  onQueue,
  onPlayAll,
  onOpenIndex,
}: Props) {
  const { chip, setChip, filters, setFilters, filterCount, tokens, sort, setSortOpen, setFilterOpen, setMenuEntry, filtered, rows, clearAll } =
    controller
  const listRef = useRef<FlatList<ListRow>>(null)
  const [visibleIndex, setVisibleIndex] = useState(0)

  // A new order or chip starts from the top.
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }, [sort, chip])

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.index != null)
    if (first?.index != null) setVisibleIndex(first.index)
  })

  const jump = useCallback((index: number) => {
    listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0 })
  }, [])

  const playAll = () => onPlayAll(filtered.length ? sortedNumbers(rows) : [])
  const countLabel = loading && !entries.length ? "Loading" : `${filtered.length.toLocaleString("en-US")} ${filtered.length === 1 ? "song" : "songs"}`

  const header = (
    <View style={[styles.sticky, { backgroundColor: theme.page, borderBottomColor: theme.line }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        <Chip theme={theme} label="All" active={chip === "all"} onPress={() => setChip("all")} />
        {songCategories.map((category) => (
          <Chip
            key={category.id}
            theme={theme}
            label={category.label}
            active={chip === category.id}
            onPress={() => setChip(category.id)}
          />
        ))}
        <Chip
          theme={theme}
          label={allCollectionsLabel(collectionCount)}
          accessibilityLabel={`${allCollectionsLabel(collectionCount)} collections, open the index`}
          onPress={onOpenIndex}
          trailing={<ChevronRight size={18} color={theme.textHeading} />}
        />
      </ScrollView>
      <View style={styles.bar}>
        <Text style={[amType.label, styles.count, { color: theme.textBody }]} numberOfLines={1}>
          {countLabel}
        </Text>
        <Press
          accessibilityRole="button"
          accessibilityLabel={filterCount ? `Filters, ${filterCount} applied` : "Filters"}
          onPress={() => setFilterOpen(true)}
          pressedScale={0.92}
          style={[styles.iconButton, { backgroundColor: theme.card, borderColor: theme.line }]}
        >
          <ListFilter size={20} color={filterCount ? theme.brand : theme.textHeading} />
        </Press>
        <Press
          accessibilityRole="button"
          accessibilityLabel={`Sort: ${sortOption(sort).title}`}
          onPress={() => setSortOpen(true)}
          pressedScale={0.95}
          style={[styles.sortButton, { backgroundColor: theme.card, borderColor: theme.line }]}
        >
          <Text style={[styles.sortLabel, { color: theme.textHeading }]} numberOfLines={1}>
            {sortOption(sort).short}
          </Text>
          <ChevronDown size={18} color={theme.textHeading} />
        </Press>
        <Press
          accessibilityRole="button"
          accessibilityLabel="Play all"
          onPress={playAll}
          pressedScale={0.95}
          style={[styles.playAll, { backgroundColor: theme.brand }]}
        >
          <Play size={16} color={theme.onBrand} fill={theme.onBrand} />
          <Text style={[styles.sortLabel, { color: theme.onBrand }]}>Play all</Text>
        </Press>
      </View>
      {tokens.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tokens}>
          {tokens.map((token) => (
            <Token key={token.id} theme={theme} label={token.label} onRemove={() => setFilters(removeToken(filters, token.id))} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  )

  const empty = loading && !entries.length ? (
    <Text style={[amType.body, styles.message, { color: theme.textMuted }]}>Loading songs…</Text>
  ) : error && !entries.length ? (
    <Press accessibilityRole="button" accessibilityLabel="Try again" onPress={onReload}>
      <Text style={[amType.body, styles.message, { color: theme.textBody }]}>{error} Tap to try again.</Text>
    </Press>
  ) : (
    <View style={styles.message}>
      <Text style={[amType.body, { color: theme.textBody }]}>No songs match.</Text>
      <Press
        accessibilityRole="button"
        accessibilityLabel="Clear filters"
        onPress={clearAll}
      >
        <Text style={[amType.label, { color: theme.eyebrow, paddingVertical: amSpace.s3 }]}>Clear filters</Text>
      </Press>
    </View>
  )

  return (
    <View style={styles.fill}>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.id}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        showsVerticalScrollIndicator={false}
        {...listPerfProps}
        onViewableItemsChanged={onViewable.current}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: false })
        }}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        renderItem={({ item }) =>
          item.kind === "header" ? (
            <Text style={[styles.groupHeader, { color: amColors.ink300 }]} accessibilityRole="header">
              {item.label}
            </Text>
          ) : (
            <View style={styles.rowWrap}>
              <SongCardRow
                theme={theme}
                entry={item.entry}
                saved={savedNumbers.has(item.entry.number)}
                offline={offlineNumbers.has(item.entry.number)}
                onOpen={onOpen}
                onToggleSave={onToggleSave}
                onQueue={onQueue}
                onMenu={setMenuEntry}
              />
            </View>
          )
        }
      />
      {railVisible(rows.length) ? <FastScrollRail theme={theme} rows={rows} visibleIndex={visibleIndex} onJump={jump} /> : null}

    </View>
  )
}

function sortedNumbers(rows: readonly ListRow[]): number[] {
  const out: number[] = []
  for (const row of rows) if (row.kind === "song") out.push(row.entry.number)
  return out
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sticky: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: amSpace.s2, gap: amSpace.s2 },
  strip: { paddingHorizontal: amGap.gutter, gap: amSpace.s2, minHeight: STRIP_HEIGHT, alignItems: "center" },
  bar: {
    paddingHorizontal: amGap.gutter,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s2,
  },
  count: { flex: 1 },
  iconButton: {
    width: amTouchTarget,
    height: amTouchTarget,
    borderRadius: amTouchTarget / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sortButton: {
    height: amTouchTarget,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    paddingHorizontal: amSpace.s3,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s1,
  },
  playAll: {
    height: amTouchTarget,
    borderRadius: amRadius.pill,
    paddingHorizontal: amSpace.s4,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s2,
  },
  sortLabel: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  tokens: { paddingHorizontal: amGap.gutter, gap: amSpace.s2 },
  rowWrap: { paddingHorizontal: amGap.gutter, paddingTop: amGap.grid },
  groupHeader: {
    fontFamily: amFonts.display,
    fontSize: 30,
    lineHeight: 36,
    textTransform: "uppercase",
    paddingHorizontal: amGap.gutter,
    paddingTop: amSpace.s6,
  },
  message: { paddingHorizontal: amGap.gutter, paddingVertical: amSpace.s8 },
})
