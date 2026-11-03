import { useId, type ReactNode } from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import Svg, { Circle, Defs, Pattern, RadialGradient, Rect, Stop } from "react-native-svg"

import { amColors } from "@/constants/tokens/amColors"
import { amGap, amRadius } from "@/constants/tokens/amSpacing"

/**
 * Forest green learn card (spec SCR-34): sage-700 ground, gold dots on an 18px
 * grid and a soft orange glow in the top-right corner. Depth by layers, no shadow.
 */
export function GreenPanel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "")
  const dots = `dots${uid}`
  const glow = `glow${uid}`
  return (
    <View style={[styles.panel, style]}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Pattern id={dots} width="18" height="18" patternUnits="userSpaceOnUse">
            <Circle cx="9" cy="9" r="1.1" fill={amColors.gold300} fillOpacity={0.3} />
          </Pattern>
          <RadialGradient id={glow} cx="100%" cy="0%" rx="75%" ry="75%" fx="100%" fy="0%">
            <Stop offset="0" stopColor={amColors.orange500} stopOpacity="0.42" />
            <Stop offset="1" stopColor={amColors.orange500} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${glow})`} />
        <Rect width="100%" height="100%" fill={`url(#${dots})`} />
      </Svg>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: amColors.sage700,
    borderRadius: amRadius.panel,
    padding: amGap.padPanel,
    gap: amGap.grid,
    overflow: "hidden",
  },
})
