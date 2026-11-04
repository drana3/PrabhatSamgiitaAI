import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Image, LayoutChangeEvent, ScrollView, StyleSheet, Text, View, type FlatList } from "react-native"
import { BlurView } from "expo-blur"
import { ChevronRightGlyph, PlayGlyph, SearchGlyph, SortGlyph } from "@/components/songs-v2/Glyphs"
import Animated, {
  runOnJS,
  runOnUI,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { FastScrollRail } from "@/components/songs-v2/FastScrollRail"
import { BrandPill } from "@/components/songs-v2/primitives"
import { Press } from "@/components/songs-v2/Press"
import { Segmented } from "@/components/songs-v2/Segmented"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { songsAssets } from "@/constants/songsAssets"
import { amSpring } from "@/constants/tokens/amMotion"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { listPerfProps } from "@/lib/listPerf"
import {
  isStripStuck,
  railJump,
  railTicks,
  rowMetrics,
  scrollOffsetForRow,
  SONGS_LAYOUT as L,
  songsSpots,
  stickyY,
} from "@/lib/songsV2/layout"
import { RAIL, railVisible } from "@/lib/songsV2/rail"
import type { SongSegmentId } from "@/lib/songsV2/segments"
import type { ListRow, RailGroup } from "@/lib/songsV2/sort"

export type StripItem = { id: string; label: string }

export type CatalogPart = {
  rows: readonly ListRow[]
  groups: readonly RailGroup[]
  grouped: boolean
  /** the order is "Category": rail ticks are three-letter category names */
  category: boolean
  strip: readonly StripItem[]
  chip: string
  onChip: (id: string) => void
  /** the "All 68" link at the end of the strip; the prototype strip has none */
  indexLabel?: string
  onOpenIndex?: () => void
  sortShort: string
  onSort: () => void
  countLabel: string
  /** the count note opens the filters (the prototype has no filter button) */
  onCount: () => void
  filterCount: number
  onPlayAll: () => void
  renderRow: (row: ListRow) => ReactNode
  empty: ReactNode
  /** a new order or chip starts from the top */
  resetKey: string
}

type Props = {
  theme: SongsTheme
  /** status area: 54 on the web board, the real safe-area top on a phone */
  inset: number
  total: number
  segment: SongSegmentId
  onSegment: (id: SongSegmentId) => void
  savedCount: number
  initial: string
  onOpenSearch: () => void
  onOpenProfile: () => void
  catalog: CatalogPart
  /** Collections and Mine content */
  body: ReactNode
}

const AnimatedBlur = Animated.createAnimatedComponent(BlurView)

/**
 * The Songs scroll surface (prototype `section.scr[aria-label="Songs"]`). One list for the three
 * segments. Above it, driven by the scroll offset and never by a timer:
 *  - the search pill sticks at the top and narrows to leave room for the avatar,
 *  - the category strip (Catalog only) sticks 64px below it, frosted once it is stuck,
 *  - the avatar stays put at the top right,
 *  - the A-Z rail fades in while the list scrolls.
 */
export function SongsScroller({
  theme,
  inset,
  total,
  segment,
  onSegment,
  savedCount,
  initial,
  onOpenSearch,
  onOpenProfile,
  catalog,
  body,
}: Props) {
  const openedAt = useRevealClock()
  const isCatalog = segment === "catalog"
  const spots = useMemo(() => songsSpots(inset), [inset])
  const listRef = useRef<FlatList<ListRow> | null>(null)

  const [width, setWidth] = useState(390)
  const [railActive, setRailActive] = useState(false)

  const scrollY = useSharedValue(0)
  const contentH = useSharedValue(1)
  const viewH = useSharedValue(1)
  const stuckPill = useSharedValue(0)
  const stuckStrip = useSharedValue(0)
  const narrow = useSharedValue(0)
  const railVis = useSharedValue(0)
  const railOn = useSharedValue(0)
  const railEnabled = useSharedValue(0)
  const held = useSharedValue(0)

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y
    contentH.value = event.contentSize.height
    viewH.value = event.layoutMeasurement.height
  })

  const pillPin = inset
  const stripPin = inset + L.stripPin

  useAnimatedReaction(
    () => spots.pillTop - scrollY.value,
    (y) => {
      stuckPill.value = withTiming(y - pillPin <= 0.5 ? 1 : 0, { duration: 200 })
      narrow.value = withTiming(y - pillPin < L.narrowLead ? 1 : 0, { duration: 200 })
    },
  )
  useAnimatedReaction(
    () => isStripStuck(scrollY.value, spots.stripTop, L.stripPin + inset),
    (stuck) => {
      stuckStrip.value = withTiming(stuck ? 1 : 0, { duration: 200 })
    },
  )

  // The rail shows while the list moves and for 1.1s after. Declared above the reaction that calls it.
  const hideRail = () => {
    "worklet"
    railVis.value = withDelay(
      1100,
      withTiming(0, { duration: 220 }, (done) => {
        if (done) {
          railOn.value = 0
          runOnJS(setRailActive)(false)
        }
      }),
    )
  }
  useAnimatedReaction(
    () => scrollY.value,
    (y, prev) => {
      if (prev === null || y === prev || !railEnabled.value || held.value) return
      if (!railOn.value) {
        railOn.value = 1
        runOnJS(setRailActive)(true)
      }
      railVis.value = withSequence(
        withTiming(1, { duration: 220 }),
        withDelay(
          1100,
          withTiming(0, { duration: 220 }, (done) => {
            if (done) {
              railOn.value = 0
              runOnJS(setRailActive)(false)
            }
          }),
        ),
      )
    },
  )

  const showRail = catalog.rows.length > 0 && railVisible(catalog.rows.length, 20) && isCatalog
  useEffect(() => {
    railEnabled.value = showRail ? 1 : 0
    if (!showRail) {
      railVis.value = 0
      railOn.value = 0
      setRailActive(false)
    }
  }, [showRail, railEnabled, railVis, railOn])

  const scrollFraction = useDerivedValue(() => Math.min(1, Math.max(0, scrollY.value / Math.max(1, contentH.value - viewH.value))))

  const metrics = useMemo(() => rowMetrics(catalog.rows, spots.listTop), [catalog.rows, spots.listTop])
  const latest = useRef({ rows: catalog.rows, groups: catalog.groups, grouped: catalog.grouped, metrics, inset })
  latest.current = { rows: catalog.rows, groups: catalog.groups, grouped: catalog.grouped, metrics, inset }

  const onScrub = useCallback((fraction: number) => {
    const cur = latest.current
    const jump = railJump(fraction, cur.rows, cur.groups, cur.grouped)
    const top = cur.metrics.offsets[jump.index]
    if (top != null) listRef.current?.scrollToOffset({ offset: scrollOffsetForRow(top, cur.inset), animated: false })
    return jump.label
  }, [])

  const onHold = useCallback(
    (isHeld: boolean) => {
      if (isHeld) {
        railOn.value = 1
        railVis.value = 1
        setRailActive(true)
      } else {
        runOnUI(hideRail)()
      }
    },
    // hideRail only touches shared values
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [railOn, railVis],
  )

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }, [catalog.resetKey])

  const ticks = useMemo(() => railTicks(catalog.groups, catalog.grouped, catalog.category), [catalog.groups, catalog.grouped, catalog.category])

  const pillSticky = useAnimatedStyle(() => ({ transform: [{ translateY: stickyY(spots.pillTop, scrollY.value, pillPin) }] }))
  const stripSticky = useAnimatedStyle(() => ({ transform: [{ translateY: stickyY(spots.stripTop, scrollY.value, stripPin) }] }))
  const pillFrost = useAnimatedStyle(() => ({ opacity: stuckPill.value }))
  const stripFrost = useAnimatedStyle(() => ({ opacity: stuckStrip.value }))
  const pillWidth = useAnimatedStyle(() => ({ width: width - 20 - narrow.value * L.pillNarrow }))

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)

  const header = (
    <View>
      <View style={{ height: inset }} />
      <SongsReveal index={0} style={styles.head}>
        <Image source={songsAssets.logoMark} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
      </SongsReveal>
      <SongsReveal index={1} style={styles.titleBlock}>
        <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
          Songs
        </Text>
        <Text style={[styles.h1, { color: theme.ink300 }]}>{total.toLocaleString("en-US")}</Text>
      </SongsReveal>
      <View style={{ height: L.pillBlock + L.pillGap }} />
      <SongsReveal index={2}>
        <Segmented theme={theme} value={segment} onChange={onSegment} savedCount={savedCount} />
      </SongsReveal>
      {isCatalog ? (
        <>
          <View style={{ height: L.stripGap + L.strip }} />
          <SongsReveal index={4} style={styles.listbar}>
            <Press
              accessibilityRole="button"
              accessibilityLabel="Sort songs"
              onPress={catalog.onSort}
              pressedScale={0.98}
              style={[styles.sortbtn, { backgroundColor: theme.card, borderColor: theme.line }]}
            >
              <SortGlyph size={18} color={theme.textHeading} />
              <Text style={[styles.sortLabel, { color: theme.textHeading }]} numberOfLines={1}>
                {catalog.sortShort}
              </Text>
            </Press>
            <Press
              accessibilityRole="button"
              accessibilityLabel={catalog.filterCount ? `${catalog.countLabel}, ${catalog.filterCount} filters applied. Open filters` : `${catalog.countLabel}. Open filters`}
              onPress={catalog.onCount}
              pressedScale={0.98}
              outerStyle={styles.noteOuter}
              style={styles.noteBox}
            >
              <Text style={[styles.note, { color: catalog.filterCount ? theme.accent : theme.textBody }]} numberOfLines={1}>
                {catalog.countLabel}
              </Text>
            </Press>
            <BrandPill theme={theme} small label="Play all" onPress={catalog.onPlayAll} icon={<PlayGlyph color="#FFFFFF" />} />
          </SongsReveal>
        </>
      ) : null}
    </View>
  )

  const metricsFor = isCatalog ? metrics : null

  return (
    <RevealClock.Provider value={openedAt}>
      <View style={[styles.fill, { backgroundColor: theme.page }]} onLayout={onLayout}>
        <Animated.FlatList
          ref={listRef as never}
          data={isCatalog ? (catalog.rows as ListRow[]) : []}
          keyExtractor={(row: ListRow) => row.id}
          renderItem={({ item }: { item: ListRow }) => (
            <View style={[styles.rowSlot, { height: (item.kind === "header" ? L.header : L.row) + L.gap }]}>{catalog.renderRow(item)}</View>
          )}
          getItemLayout={
            metricsFor
              ? (_data: unknown, index: number) => ({
                  length: metricsFor.heights[index],
                  offset: metricsFor.offsets[index],
                  index,
                })
              : undefined
          }
          ListHeaderComponent={header}
          ListEmptyComponent={isCatalog ? <View style={styles.empty}>{catalog.empty}</View> : null}
          ListFooterComponent={isCatalog ? null : <View style={styles.body}>{body}</View>}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: L.bottom }}
          {...listPerfProps}
        />

        {/* sticky pill: frost behind it appears once it is stuck */}
        <Animated.View pointerEvents="none" style={[styles.pillFrost, { height: inset + L.pillBlock }, pillFrost]}>
          <View style={{ height: inset, backgroundColor: theme.page }} />
          <View style={styles.fill}>
            <BlurView intensity={40} tint={theme.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.page, opacity: 0.95 }]} />
          </View>
        </Animated.View>
        <Animated.View style={[styles.pillWrap, pillSticky]}>
          <SongsReveal index={2}>
            <Animated.View style={[styles.pillSlot, pillWidth]}>
              <Press
                accessibilityRole="search"
                accessibilityLabel="Search a number, a name or a feeling"
                onPress={onOpenSearch}
                pressedScale={0.98}
                style={[styles.pillfield, { backgroundColor: theme.card, borderColor: theme.line }]}
              >
                <SearchGlyph color={theme.textBody} />
                <Text style={[styles.pillText, { color: theme.textBody }]} numberOfLines={1}>
                  Search a number, a name or a feeling
                </Text>
              </Press>
            </Animated.View>
          </SongsReveal>
        </Animated.View>

        {isCatalog ? (
          <Animated.View style={[styles.stripWrap, stripSticky]}>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, stripFrost]}>
              <BlurView intensity={40} tint={theme.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.page, opacity: 0.88 }]} />
              <View style={[styles.hair, { backgroundColor: theme.line }]} />
            </Animated.View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripIn}>
              {catalog.strip.map((item) => (
                <Stab key={item.id} theme={theme} label={item.label} on={catalog.chip === item.id} onPress={() => catalog.onChip(item.id)} />
              ))}
              {catalog.indexLabel && catalog.onOpenIndex ? (
                <Stab theme={theme} label={catalog.indexLabel} on={false} onPress={catalog.onOpenIndex} trailing />
              ) : null}
            </ScrollView>
          </Animated.View>
        ) : null}

        <View style={[styles.avatarSlot, { top: inset + 6 }]} pointerEvents="box-none">
          <Press
            accessibilityRole="button"
            accessibilityLabel="Profile and settings"
            onPress={onOpenProfile}
            pressedScale={0.94}
            style={[styles.avatar, { backgroundColor: theme.peach }]}
          >
            <Text style={[styles.avatarText, { color: theme.accent }]}>{initial}</Text>
          </Press>
        </View>

        {showRail ? (
          <FastScrollRail
            theme={theme}
            top={inset + RAIL.topBelowInset}
            ticks={ticks}
            visible={railVis}
            interactive={railActive}
            scrollFraction={scrollFraction}
            held={held}
            onScrub={onScrub}
            onHold={onHold}
          />
        ) : null}
      </View>
    </RevealClock.Provider>
  )
}

/** Prototype `.stab`: 52px, 15.5/700, quiet until chosen, with a 3px orange underline that grows from the middle. */
function Stab({
  theme,
  label,
  on,
  onPress,
  trailing,
}: {
  theme: SongsTheme
  label: string
  on: boolean
  onPress: () => void
  trailing?: boolean
}) {
  const grow = useSharedValue(on ? 1 : 0)
  useEffect(() => {
    grow.value = withSpring(on ? 1 : 0, amSpring.default)
  }, [on, grow])
  const underline = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.value }] }))
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      pressedScale={0.97}
      style={styles.stab}
    >
      <Text style={[styles.stabText, { color: on ? theme.ink900 : theme.textBody }]}>{label}</Text>
      {trailing ? <ChevronRightGlyph size={16} color={theme.textBody} /> : null}
      <Animated.View style={[styles.stabLine, { backgroundColor: theme.brand }, underline]} />
    </Press>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { height: L.head, paddingHorizontal: 10, justifyContent: "center" },
  logo: { height: 36, width: 30 },
  titleBlock: { paddingTop: 12, paddingHorizontal: 10, paddingBottom: 20 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase", fontVariant: ["tabular-nums"] },
  listbar: { height: L.listbar, flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 12, paddingBottom: 12, paddingLeft: 10, paddingRight: 32 },
  sortbtn: { height: 40, paddingLeft: 12, paddingRight: 16, borderRadius: 70, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  sortLabel: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  noteOuter: { flex: 1, minWidth: 0 },
  noteBox: { height: 40, justifyContent: "center", alignItems: "flex-end" },
  note: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, textAlign: "right", fontVariant: ["tabular-nums"] },
  rowSlot: { paddingLeft: 10, paddingRight: RAIL.listPaddingRight },
  empty: { paddingHorizontal: 20, paddingTop: 12 },
  body: {},
  pillFrost: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 8 },
  pillWrap: { position: "absolute", top: 0, left: 0, right: 0, height: L.pillBlock, zIndex: 9, paddingLeft: 10 },
  pillSlot: { height: 56 },
  pillfield: { height: 56, borderRadius: 70, borderWidth: 1, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 12 },
  pillText: { flex: 1, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 20 },
  stripWrap: { position: "absolute", top: 0, left: 0, right: 0, height: L.strip, zIndex: 8 },
  stripIn: { paddingHorizontal: 6 },
  hair: { position: "absolute", left: 0, right: 0, bottom: 0, height: 1 },
  stab: { height: L.strip, paddingHorizontal: 10, flexDirection: "row", alignItems: "center" },
  stabText: { fontFamily: amFonts.bold, fontSize: 15.5, lineHeight: 20, letterSpacing: -0.08 },
  stabChev: { marginLeft: 2 },
  stabLine: { position: "absolute", left: 10, right: 10, bottom: 6, height: 3, borderRadius: 9999 },
  avatarSlot: { position: "absolute", right: 10, width: 44, height: 44, zIndex: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: amFonts.bold, fontSize: 18, lineHeight: 22 },
})
