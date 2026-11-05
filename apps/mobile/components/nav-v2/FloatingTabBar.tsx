import { useCallback, useEffect, useState } from "react"
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import { BlurView } from "expo-blur"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
    cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useCoverFade, useSheetCover } from "@/components/nav-v2/sheetCover"
import { TabGlyph } from "@/components/today/protoIcons"
import { amSpring } from "@/constants/tokens/amMotion"
import { amNav } from "@/constants/tokens/amNav"
import { amRadius } from "@/constants/tokens/amSpacing"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useLanguage } from "@/lib/i18n"
import {
  NAV_V2_TABS,
  navV2Layout,
  releaseSpringKind,
  rubberBand,
  settleTabIndex,
  tabIndexAtX,
  tabIndexForId,
  tabPillPalette,
  isDarkTheme,
  type NavV2Tab,
  type NavV2TabId,
} from "@/lib/navV2"
import { MAX_FONT_SCALE } from "@/constants/fontScale"

/** Finger travel (px) before a touch counts as a drag instead of a tap. */
const DRAG_SLOP = 4

type Props = {
  /** tab that is currently shown */
  activeId: NavV2TabId
  /** called once, on release, with the tab the indicator settled on */
  onSelect: (id: NavV2TabId) => void
  /** optional: the tab that is already active was tapped (a screen that sits on top of a tab uses it to close) */
  onReselect?: (id: NavV2TabId) => void
  tabs?: readonly NavV2Tab[]
}

/**
 * Floating glass tab pill with a sliding orange indicator (spec 2.1, SCR-07, SCR-12).
 *
 * - The indicator answers on touch-down (it heads for the touched tab at once).
 * - Dragging moves it 1:1 from where the finger grabbed it, with a rubber band at the ends.
 * - On release it settles on the tab found by momentum projection of the finger's velocity.
 * - Position and press state are shared values animated by springs from their current
 *   on-screen value, so every motion can be interrupted. Only transform and opacity animate.
 * - With Reduce Motion the indicator jumps and the fill cross-fades; no springs.
 */
export function FloatingTabBar({ activeId, onSelect, onReselect, tabs = NAV_V2_TABS }: Props) {
  const theme = useAmTheme()
  useLanguage() // tab labels are read from the active language
  const insets = useSafeAreaInsets()
  const reduce = useReducedMotion()
  const count = tabs.length
  const activeIndex = tabIndexForId(activeId, tabs)
  const lightPalette = tabPillPalette(theme, "light")
  const { tabBottom } = navV2Layout(insets.bottom)

  const [trayWidth, setTrayWidth] = useState(0)
  const trayW = useSharedValue(0)
  const x = useSharedValue(0)
  const targetIndex = useSharedValue(activeIndex)
  const pressed = useSharedValue(0)
  const dragging = useSharedValue(0)
  const grab = useSharedValue(0)

  const tabWidth = count > 0 ? trayWidth / count : 0

  const onTrayLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width
      setTrayWidth(width)
      trayW.value = width
      // a new width (first layout, rotation) snaps; it is not a gesture
      cancelAnimation(x)
      x.value = targetIndex.value * (count > 0 ? width / count : 0)
    },
    [count, targetIndex, trayW, x],
  )

  // The route changed from somewhere else (deep link, back, a button): follow it.
  // A change we caused ourselves on release is already in flight with its velocity.
  useEffect(() => {
    if (targetIndex.value === activeIndex) return
    targetIndex.value = activeIndex
    const target = activeIndex * tabWidth
    x.value = reduce ? target : withSpring(target, amSpring.default)
  }, [activeIndex, reduce, tabWidth, targetIndex, x])

  const commit = useCallback(
    (index: number) => {
      const tab = tabs[index]
      if (!tab) return
      if (tab.id !== activeId) onSelect(tab.id)
      else onReselect?.(tab.id)
    },
    [tabs, activeId, onSelect, onReselect],
  )

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((event) => {
      "worklet"
      const tw = trayW.value / count
      if (tw <= 0) return
      const px = event.x - amNav.tabPad
      dragging.value = 0
      pressed.value = reduce ? 1 : withSpring(1, amSpring.default)
      // touch-down feedback: unless the finger landed on the indicator, head for the touched tab now
      if (px < x.value || px > x.value + tw) {
        const index = tabIndexAtX(px, tw, count)
        targetIndex.value = index
        x.value = reduce ? index * tw : withSpring(index * tw, amSpring.default)
      }
    })
    .onUpdate((event) => {
      "worklet"
      const tw = trayW.value / count
      if (tw <= 0) return
      const px = event.x - amNav.tabPad
      if (!dragging.value) {
        if (Math.abs(event.translationX) < DRAG_SLOP) return
        // take over from wherever the indicator is on screen right now: no jump
        dragging.value = 1
        cancelAnimation(x)
        grab.value = px - x.value
      }
      x.value = rubberBand(px - grab.value, 0, (count - 1) * tw, trayW.value)
    })
    .onEnd((event) => {
      "worklet"
      const tw = trayW.value / count
      pressed.value = reduce ? 0 : withSpring(0, amSpring.default)
      if (tw <= 0) return
      let index: number
      let velocity = 0
      if (dragging.value) {
        velocity = event.velocityX
        index = settleTabIndex({ indicatorX: x.value, velocity, tabWidth: tw, count })
      } else {
        index = tabIndexAtX(event.x - amNav.tabPad, tw, count)
      }
      dragging.value = 0
      targetIndex.value = index
      const base = releaseSpringKind(velocity) === "fling" ? amSpring.fling : amSpring.default
      x.value = reduce ? index * tw : withSpring(index * tw, { ...base, velocity })
      scheduleOnRN(commit, index)
    })
    .onFinalize((_event, success) => {
      "worklet"
      if (success) return
      // cancelled by the system: put the indicator back where the route says it is
      const tw = trayW.value / count
      dragging.value = 0
      pressed.value = reduce ? 0 : withSpring(0, amSpring.default)
      x.value = reduce ? targetIndex.value * tw : withSpring(targetIndex.value * tw, amSpring.default)
    })

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scale: 1 - (1 - amNav.pressedScale) * pressed.value }],
  }))
  const insideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -x.value }] }))

  const blurTint = isDarkTheme(theme) ? "dark" : "light"
  const coverFade = useCoverFade()
  const covered = useSheetCover((c) => c.count > 0)

  return (
    <Animated.View pointerEvents={covered ? "none" : "box-none"} style={[styles.slot, { bottom: tabBottom }, coverFade]}>
      <GestureDetector gesture={pan}>
        <View style={styles.pill} collapsable={false}>
          <BlurView
            intensity={amNav.tabBlurIntensity}
            tint={blurTint}
            experimentalBlurMethod="dimezisBlurView"
            style={[StyleSheet.absoluteFill, styles.round]}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.round, { backgroundColor: lightPalette.background }]} />
          <View pointerEvents="none" style={[styles.edge, { borderColor: lightPalette.edge }]} />

          <View style={styles.tray} onLayout={onTrayLayout}>
            <View pointerEvents="none" style={styles.row}>
              <Faces tabs={tabs} color={lightPalette.inactive} />
            </View>

            {/* orange indicator; the white faces inside it are revealed by its mask */}
            <Animated.View
              pointerEvents="none"
              style={[styles.indicator, { width: tabWidth, backgroundColor: theme.brand }, indicatorStyle]}
            >
              <Animated.View style={[styles.insideRow, { width: trayWidth }, insideStyle]}>
                <Faces tabs={tabs} color={theme.onBrand} />
              </Animated.View>
            </Animated.View>

            {/* screen-reader layer: one real control per tab, outside the gesture's visuals */}
            <View style={styles.row} accessibilityRole="tablist">
              {tabs.map((tab, index) => (
                <View
                  key={tab.id}
                  style={styles.hit}
                  accessible
                  accessibilityRole="tab"
                  accessibilityLabel={tab.label}
                  accessibilityState={{ selected: index === activeIndex }}
                  accessibilityActions={[{ name: "activate" }]}
                  onAccessibilityAction={() => commit(index)}
                />
              ))}
            </View>
          </View>
        </View>
      </GestureDetector>
    </Animated.View>
  )
}

function Faces({ tabs, color }: { tabs: readonly NavV2Tab[]; color: string }) {
  return (
    <>
      {tabs.map((tab) => {
        return (
          <View
            key={tab.id}
            style={styles.face}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <TabGlyph name={tab.icon} size={22} color={color} />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.label, { color }]} numberOfLines={1}>
              {tab.label}
            </Text>
          </View>
        )
      })}
    </>
  )
}

const styles = StyleSheet.create({
  slot: {
    position: "absolute",
    left: amNav.inset,
    right: amNav.inset,
  },
  pill: {
    height: amNav.tabHeight,
    borderRadius: amNav.radius,
    overflow: "hidden",
    padding: amNav.tabPad,
  },
  /** every layer under the pill carries its radius, so no square fill or blur can show around it */
  round: { borderRadius: amNav.radius, overflow: "hidden" },
  edge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: amNav.radius,
    borderWidth: 1,
  },
  tray: {
    flex: 1,
  },
  row: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
  },
  insideRow: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
  },
  indicator: {
    position: "absolute",
    left: 0,
    top: 0,
    height: amNav.tabItemHeight,
    borderRadius: amRadius.pill,
    overflow: "hidden",
  },
  face: {
    flex: 1,
    height: amNav.tabItemHeight,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    // the prototype's icon + label stack sits 1dp lower than the centred position (svg line box)
    paddingTop: 2,
  },
  hit: {
    flex: 1,
    height: amNav.tabItemHeight,
  },
  label: {
    fontFamily: amFonts.semi,
    fontSize: 12,
    lineHeight: 14,
  },
})

