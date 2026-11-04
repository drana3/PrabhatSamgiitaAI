import { useId, type ReactNode } from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import Svg, { Circle, Defs, Pattern, RadialGradient, Rect, Stop } from "react-native-svg"

import { amColors } from "@/constants/tokens/amColors"
import { amGap, amRadius } from "@/constants/tokens/amSpacing"

/**
 * The background of `.lcard.dark.green.prg` in the prototype: gold dots on an 18px grid
 * (circle at 1px 1px, 1.1px solid, fading to 1.7px, at 0.34) and an orange glow from
 * the top right corner (80% x 95% ellipse, 0.2 fading out at 65%) over sage-700.
 * Depth by layers, no shadow.
 */
export function DottedGlow({ glow = 0.2 }: { glow?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "")
  const dots = `dots${uid}`
  const halo = `glow${uid}`
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id={dots} width="18" height="18" patternUnits="userSpaceOnUse">
          <Circle cx="1" cy="1" r="1.4" fill={amColors.gold300} fillOpacity={0.34} />
        </Pattern>
        {/* an ellipse of 80% x 95% of the panel at its top right corner. SVG has no rx/ry on a gradient, so it
            is a unit circle in bounding-box space, squeezed by the transform (works on web and native) */}
        <RadialGradient id={halo} cx="1" cy="0" r="1" fx="1" fy="0" gradientTransform="translate(1 0) scale(0.8 0.95) translate(-1 0)">
          <Stop offset="0" stopColor={amColors.orange500} stopOpacity={glow} />
          <Stop offset="0.65" stopColor={amColors.orange500} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${halo})`} />
      <Rect width="100%" height="100%" fill={`url(#${dots})`} />
    </Svg>
  )
}

/** Forest green learn panel with the dotted glow. */
export function GreenPanel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.panel, style]}>
      <DottedGlow />
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: amColors.sage700,
    borderRadius: amRadius.panel,
    padding: amGap.padPanel,
    gap: 12,
    overflow: "hidden",
  },
})
