import { useEffect, useRef, useState } from "react"
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native"

import { colors } from "@/constants/colors"
import { journeyMarqueeCycleWidth, type SongJourneyTab } from "@/constants/songJourney"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

export const JOURNEY_CHIP_GAP = spacing.md

type TabItem = {
  id: SongJourneyTab
  label: string
  hint: string
}

type Props = {
  tabs: readonly TabItem[]
  selected: SongJourneyTab
  onSelect: (id: SongJourneyTab) => void
}

function TabChip({
  item,
  active,
  onPress,
}: {
  item: TabItem
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${item.label}, ${item.hint}`}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
        {item.label}
      </Text>
      <Text style={[styles.hint, active && styles.hintActive]} numberOfLines={1}>
        {item.hint}
      </Text>
    </Pressable>
  )
}

/** Journey tabs revolve when they overflow. Gap stays even, including the loop join. */
export function SongJourneyTicker({ tabs, selected, onSelect }: Props) {
  const scrollRef = useRef<ScrollView>(null)
  const offsetRef = useRef(0)
  const pausedUntilRef = useRef(0)
  const cycleWidthRef = useRef(0)
  const [cycleWidth, setCycleWidth] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)

  const shouldMarquee = cycleWidth > viewportWidth + 24
  cycleWidthRef.current = cycleWidth

  useEffect(() => {
    if (Platform.OS === "android") return
    if (!shouldMarquee || cycleWidth < 24) {
      offsetRef.current = 0
      scrollRef.current?.scrollTo({ x: 0, animated: false })
      return
    }
    const step = 0.7
    const id = setInterval(() => {
      if (Date.now() < pausedUntilRef.current) return
      let next = offsetRef.current + step
      const cycle = cycleWidthRef.current
      if (cycle > 0 && next >= cycle) next -= cycle
      offsetRef.current = next
      scrollRef.current?.scrollTo({ x: next, animated: false })
    }, 32)
    return () => clearInterval(id)
  }, [shouldMarquee, cycleWidth, tabs.length])

  const pause = (ms = 2800) => {
    pausedUntilRef.current = Date.now() + ms
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x
    const cycle = cycleWidthRef.current
    if (shouldMarquee && cycle > 0 && x >= cycle) {
      const wrapped = x - cycle
      offsetRef.current = wrapped
      scrollRef.current?.scrollTo({ x: wrapped, animated: false })
      return
    }
    offsetRef.current = x
  }

  const renderChipSet = (keyPrefix: string) =>
    tabs.map((item) => (
      <TabChip
        key={`${keyPrefix}-${item.id}`}
        item={item}
        active={selected === item.id}
        onPress={() => {
          pause(3500)
          onSelect(item.id)
        }}
      />
    ))

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      accessibilityLabel="Song sections"
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled
        contentContainerStyle={styles.row}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => pause(4000)}
        onTouchStart={() => pause(4000)}
      >
        <View
          style={styles.loopSet}
          onLayout={(e) => {
            setCycleWidth(journeyMarqueeCycleWidth(e.nativeEvent.layout.width, JOURNEY_CHIP_GAP))
          }}
        >
          {renderChipSet("a")}
        </View>
        {shouldMarquee || cycleWidth === 0 ? (
          <View style={styles.loopSet} importantForAccessibility="no-hide-descendants">
            {renderChipSet("b")}
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: JOURNEY_CHIP_GAP,
  },
  loopSet: {
    flexDirection: "row",
    alignItems: "center",
    gap: JOURNEY_CHIP_GAP,
  },
  chip: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 96,
    alignItems: "center",
  },
  chipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  label: { ...typography.label, color: colors.textPrimary, textAlign: "center" },
  labelActive: { color: colors.white },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: 2, textAlign: "center" },
  hintActive: { color: "rgba(255,255,255,0.7)" },
})
