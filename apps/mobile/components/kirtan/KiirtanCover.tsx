import { useState } from "react"
import { StyleSheet, View, type DimensionValue } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import Svg, { Path } from "react-native-svg"

import { amColors } from "@/constants/tokens/amColors"

/**
 * The picture of a Kiirtan: the author's cover when there is one, otherwise a gradient that belongs to
 * the Kiirtan's TYPE (so the same four colours run through the tab, the rows, the pill and the player).
 * A sound-wave glyph sits on it.
 */
export const KIIRTAN_TYPE_TONES: Record<string, readonly [string, string]> = {
  bnk: [amColors.orange500, amColors.orange700],
  lila: [amColors.sage700, amColors.sage900],
  festival: [amColors.gold500, amColors.orange600],
  other: [amColors.sage500, amColors.sage800],
}

export function kiirtanTone(type: string | null | undefined): readonly [string, string] {
  return KIIRTAN_TYPE_TONES[type ?? "other"] ?? KIIRTAN_TYPE_TONES.other
}

/** Five vertical bars of different height: a sound wave. */
export function WaveGlyph({ size = 24, color = "#FFFFFF", strokeWidth = 2 }: { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Path d="M4 10v4M8 6.5v11M12 3.5v17M16 7v10M20 10v4" />
    </Svg>
  )
}

type Props = {
  type: string | null | undefined
  coverUrl?: string | null
  width: DimensionValue
  height?: number
  aspectRatio?: number
  radius: number
  /** pixel size of the glyph; derived from the width when it is a number */
  glyph?: number
}

export function KiirtanCover({ type, coverUrl, width, height, aspectRatio, radius, glyph }: Props) {
  const [failed, setFailed] = useState(false)
  const [from, to] = kiirtanTone(type)
  const basis = typeof width === "number" ? Math.min(width, height ?? width) : 120
  const size = glyph ?? Math.max(16, Math.round(basis * 0.42))
  const showImage = Boolean(coverUrl) && !failed
  return (
    <View style={{ width, height, aspectRatio, borderRadius: radius, overflow: "hidden" }}>
      <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <WaveGlyph size={size} color="rgba(255,255,255,0.86)" strokeWidth={size > 40 ? 1.6 : 2} />
      </View>
      {showImage ? (
        <Image source={{ uri: coverUrl as string }} contentFit="cover" accessibilityIgnoresInvertColors onError={() => setFailed(true)} style={StyleSheet.absoluteFill} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
})
