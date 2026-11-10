import { useEffect, useState } from "react"
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"

import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amSpring } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"
import { usePageT } from "@/lib/songPage/pageCopy"
import { SONG_TABS, TAB_LABEL_KEY, type SongTab } from "@/lib/songPage/songTabs"

const BAR_INSET = 14
const BAR_HEIGHT = 3

/**
 * The tab switch of the song page: five equal tabs in the fixed order Lyrics, Words, Chords, Video, Info, with a bar
 * under the chosen one. A tap answers at once (the label and the press scale react on pointer down); the bar moves
 * on a spring from where it is now, so a second tap in the middle of the move turns it around. Only transform moves.
 */
export function PageTabs({ t, active, onSelect }: { t: SpTheme; active: SongTab; onSelect: (tab: SongTab) => void }) {
  const tr = usePageT()
  const reduce = useReducedMotion()
  const [width, setWidth] = useState(0)
  const slot = width / SONG_TABS.length
  const x = useSharedValue(0)
  const index = SONG_TABS.indexOf(active)
  useEffect(() => {
    if (!slot) return
    const to = index * slot
    x.value = reduce ? withTiming(to, { duration: 150 }) : withSpring(to, amSpring.default)
  }, [index, slot, reduce, x])
  const bar = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  return (
    <View
      style={styles.wrap}
      accessibilityRole="tablist"
      accessibilityLabel={tr("songPage.tabs.a11y")}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
    >
      {SONG_TABS.map((id) => {
        const on = id === active
        const label = tr(TAB_LABEL_KEY[id])
        return (
          <SpPress key={id} onPress={() => onSelect(id)} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on }} pressedScale={0.94} style={styles.tab}>
            <Text style={[styles.label, { color: on ? t.ink900 : t.ink500, fontFamily: on ? amFonts.bold : amFonts.semi }]} numberOfLines={1}>
              {label}
            </Text>
          </SpPress>
        )
      })}
      {slot ? <Animated.View pointerEvents="none" style={[styles.bar, { width: slot - BAR_INSET * 2, left: BAR_INSET, backgroundColor: t.action }, bar]} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: "row" },
  tab: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  label: { fontSize: 15, lineHeight: 20 },
  bar: { position: "absolute", bottom: 0, height: BAR_HEIGHT, borderRadius: 2 },
})
