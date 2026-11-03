import { useEffect } from "react"
import { StyleSheet, Text, View } from "react-native"
import { ChevronDown } from "lucide-react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated"

import { TouchButton } from "@/components/player-v2/TouchButton"
import { playerColors } from "@/components/player-v2/playerTokens"
import { amSpring } from "@/constants/tokens/amMotion"
import { amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFontSize, amFonts, amType } from "@/constants/tokens/amTypography"
import { playModeLabel, type PlayMode } from "@/lib/playerV2/versionMode"

/** `PS 1  Voice · Performer A  v  2/6`: which recording plays; opens the Versions sheet (SCR-18). */
export function VersionChip({
  songNumber,
  summary,
  position,
  onPress,
}: {
  songNumber: number
  summary: string
  position: string | null
  onPress: () => void
}) {
  return (
    <TouchButton
      accessibilityRole="button"
      accessibilityLabel={`Version: ${summary}${position ? `, ${position}` : ""}. Choose a version`}
      onAction={onPress}
      containerStyle={styles.chipHit}
      style={styles.chip}
    >
      <Text style={styles.ps}>PS {songNumber}</Text>
      <Text style={styles.summary} numberOfLines={1}>
        {summary}
      </Text>
      {position ? <Text style={styles.position}>{position}</Text> : null}
      <ChevronDown size={16} color={playerColors.textSoft} />
    </TouchButton>
  )
}

/** `Play: This version | All 6 versions`, always visible under the title (SCR-40 option A). */
export function PlayModeToggle({
  mode,
  versionCount,
  onChange,
}: {
  mode: PlayMode
  versionCount: number
  onChange: (mode: PlayMode) => void
}) {
  const reduce = useReducedMotion()
  const width = useSharedValue(0)
  const selected = useSharedValue(mode === "all" ? 1 : 0)
  const allDisabled = versionCount < 2

  useEffect(() => {
    selected.value = withSpring(mode === "all" ? 1 : 0, amSpring.default)
  }, [mode, selected])

  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: reduce ? (selected.value > 0.5 ? width.value / 2 : 0) : (selected.value * width.value) / 2 }],
  }))

  return (
    <View style={styles.toggleRow}>
      <Text style={styles.playLabel}>Play</Text>
      <View style={styles.toggle} onLayout={(e) => (width.value = e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.indicator, indicator]} />
        <TouchButton
          accessibilityRole="radio"
          accessibilityState={{ selected: mode === "this" }}
          accessibilityLabel="Play this version"
          onAction={() => onChange("this")}
          pressedScale={0.98}
          containerStyle={styles.segmentHit}
          style={styles.segment}
        >
          <Text style={[styles.segmentText, mode === "this" && styles.segmentOn]}>{playModeLabel("this", versionCount)}</Text>
        </TouchButton>
        <TouchButton
          accessibilityRole="radio"
          accessibilityState={{ selected: mode === "all", disabled: allDisabled }}
          accessibilityLabel={allDisabled ? "Play all versions, only one version exists" : `Play all ${versionCount} versions`}
          onAction={allDisabled ? undefined : () => onChange("all")}
          pressedScale={0.98}
          containerStyle={styles.segmentHit}
          style={[styles.segment, allDisabled && styles.disabled]}
        >
          <Text style={[styles.segmentText, mode === "all" && styles.segmentOn]}>
            {playModeLabel("all", Math.max(1, versionCount))}
          </Text>
        </TouchButton>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  chipHit: { alignSelf: "flex-start", maxWidth: "100%" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s2,
    minHeight: amTouchTarget,
    paddingHorizontal: amSpace.s3,
    borderRadius: amRadius.pill,
    backgroundColor: playerColors.glass,
    borderWidth: 1,
    borderColor: playerColors.glassEdge,
  },
  ps: { ...amType.label, color: playerColors.gold },
  summary: { ...amType.body, fontFamily: amFonts.medium, color: playerColors.text, flexShrink: 1 },
  position: { ...amType.label, color: playerColors.gold },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: amSpace.s3 },
  playLabel: { ...amType.label, color: playerColors.textSoft },
  toggle: {
    flex: 1,
    flexDirection: "row",
    height: amTouchTarget,
    borderRadius: amRadius.pill,
    backgroundColor: playerColors.glass,
    borderWidth: 1,
    borderColor: playerColors.glassEdge,
    overflow: "hidden",
  },
  indicator: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "50%",
    borderRadius: amRadius.pill,
    backgroundColor: playerColors.brand,
  },
  segmentHit: { flex: 1 },
  segment: { flex: 1, height: "100%", alignItems: "center", justifyContent: "center" },
  segmentText: { ...amType.body, fontFamily: amFonts.semi, fontSize: amFontSize.label, color: playerColors.textSoft },
  segmentOn: { color: playerColors.onBrand },
  disabled: { opacity: 0.4 },
})
