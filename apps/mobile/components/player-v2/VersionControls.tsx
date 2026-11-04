import { useEffect } from "react"
import { StyleSheet, Text, View } from "react-native"
import { BlurView } from "expo-blur"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { TouchButton } from "@/components/player-v2/TouchButton"
import { playerColors, playerSize } from "@/components/player-v2/playerTokens"
import { amSpring } from "@/constants/tokens/amMotion"
import { amColors } from "@/constants/tokens/amColors"
import { amRadius } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { playModeLabel, type PlayMode } from "@/lib/playerV2/versionMode"

/**
 * `PS 1  Voice · Performer A  v` (prototype .vchip): which recording plays; opens the
 * Versions sheet. While "All N versions" is on, the position `2/6` sits in gold.
 */
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
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <Text style={styles.ps}>PS {songNumber}</Text>
      <Text style={styles.summary} numberOfLines={1}>
        {summary}
      </Text>
      {position ? <Text style={styles.position}>{position}</Text> : null}
      <PlayerIcon name="chevronSmall" size={playerSize.chipIcon} color={amColors.white} />
    </TouchButton>
  )
}

/** `Play  [This version | All 6 versions]` under the title (prototype .vscope). */
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
    const target = mode === "all" ? 1 : 0
    selected.value = reduce ? withTiming(target, { duration: 150 }) : withSpring(target, amSpring.default)
  }, [mode, reduce, selected])

  const indicator = useAnimatedStyle(() => {
    const half = Math.max(0, (width.value - (playerSize.scopePad - 1) * 2) / 2)
    return { width: half, transform: [{ translateX: selected.value * half }] }
  })

  return (
    <View style={styles.toggleRow}>
      <Text style={styles.playLabel}>Play</Text>
      <View style={styles.toggle}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <View
          style={styles.inner}
          onLayout={(e) => {
            width.value = e.nativeEvent.layout.width
          }}
        >
          <Animated.View pointerEvents="none" style={[styles.indicator, indicator]} />
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
            <PlayerIcon
              name="versions"
              size={playerSize.scopeIcon}
              color={mode === "all" ? amColors.sage900 : playerColors.scopeText}
            />
            <Text style={[styles.segmentText, mode === "all" && styles.segmentOn]}>
              {playModeLabel("all", Math.max(1, versionCount))}
            </Text>
          </TouchButton>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  chipHit: { alignSelf: "stretch" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: playerSize.chipHeight,
    paddingHorizontal: 12,
    borderRadius: amRadius.pill,
    backgroundColor: playerColors.chipFill,
    borderWidth: 1,
    borderColor: playerColors.chipEdge,
    overflow: "hidden",
  },
  ps: { fontFamily: amFonts.medium, fontSize: 13, color: amColors.white, fontVariant: ["tabular-nums"] },
  summary: { fontFamily: amFonts.bold, fontSize: 13, color: amColors.white, flexShrink: 1 },
  position: {
    marginLeft: "auto",
    fontFamily: amFonts.bold,
    fontSize: 13,
    color: playerColors.gold,
    fontVariant: ["tabular-nums"],
  },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, marginHorizontal: 20 },
  playLabel: { ...amType.label, color: playerColors.scopeLabel },
  toggle: {
    flex: 1,
    height: playerSize.scopeHeight,
    borderRadius: amRadius.pill,
    backgroundColor: playerColors.scopeFill,
    borderWidth: 1,
    borderColor: playerColors.scopeEdge,
    overflow: "hidden",
  },
  inner: { flex: 1, flexDirection: "row", padding: playerSize.scopePad - 1 },
  indicator: {
    position: "absolute",
    top: playerSize.scopePad - 1,
    bottom: playerSize.scopePad - 1,
    left: playerSize.scopePad - 1,
    borderRadius: amRadius.pill,
    backgroundColor: amColors.white,
  },
  segmentHit: { flex: 1 },
  segment: { flex: 1, height: "100%", flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  segmentText: { fontFamily: amFonts.semi, fontSize: 13, color: playerColors.scopeText },
  segmentOn: { fontFamily: amFonts.bold, color: amColors.sage900 },
  disabled: { opacity: 0.4 },
})
