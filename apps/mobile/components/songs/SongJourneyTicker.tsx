import { useEffect, useRef, useState } from "react"
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"

import { colors } from "@/constants/colors"
import type { SongJourneyTab } from "@/constants/songJourney"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

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
      <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
      <Text style={[styles.hint, active && styles.hintActive]}>{item.hint}</Text>
    </Pressable>
  )
}

/**
 * Journey tabs. Auto-scroll only when chips overflow (e.g. 4 tabs).
 * Overflow mode duplicates the row for a seamless circular marquee.
 * Three-or-fewer tabs stay static — no ticker flicker.
 */
export function SongJourneyTicker({ tabs, selected, onSelect }: Props) {
  const scrollRef = useRef<ScrollView>(null)
  const offsetRef = useRef(0)
  const pausedUntilRef = useRef(0)
  const cycleWidthRef = useRef(0)
  const [cycleWidth, setCycleWidth] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)

  const shouldMarquee = tabs.length > 3 && cycleWidth > viewportWidth + 24
  cycleWidthRef.current = cycleWidth

  useEffect(() => {
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

  const renderChips = (keyPrefix: string) =>
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

  // Static row when 3 or fewer tabs — no ScrollView, no flicker.
  if (tabs.length <= 3) {
    return (
      <View style={styles.wrap} accessibilityRole="tablist" accessibilityLabel="Song sections">
        <View style={styles.staticRow}>
          {tabs.map((item) => (
            <TabChip
              key={item.id}
              item={item}
              active={selected === item.id}
              onPress={() => onSelect(item.id)}
            />
          ))}
        </View>
      </View>
    )
  }

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
            // Include trailing gap so wrap lands on the start of the copy.
            setCycleWidth(e.nativeEvent.layout.width + spacing.sm)
          }}
        >
          {renderChips("a")}
        </View>
        {shouldMarquee || cycleWidth === 0 ? (
          <View style={styles.loopSet} importantForAccessibility="no-hide-descendants">
            {renderChips("b")}
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
  staticRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  loopSet: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 96,
  },
  chipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  label: { ...typography.label, color: colors.textPrimary },
  labelActive: { color: colors.white },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  hintActive: { color: "rgba(255,255,255,0.7)" },
})
