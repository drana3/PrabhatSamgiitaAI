import { Platform, View, type StyleProp, type ViewStyle } from "react-native"
import { BlurView } from "expo-blur"

import { frostFallbackColor, type FrostTint } from "@/lib/frost"

/**
 * A frosted-glass layer. iOS (and web) get the real blur. Android gets a solid translucent fill:
 * expo-blur's default there is not a blur at all, and the only real method is expensive on cheap phones.
 */
export function Frost({ intensity, tint, style }: { intensity: number; tint: FrostTint; style?: StyleProp<ViewStyle> }) {
  if (Platform.OS === "android") {
    return <View pointerEvents="none" style={[style, { backgroundColor: frostFallbackColor(tint, intensity) }]} />
  }
  return <BlurView intensity={intensity} tint={tint} style={style} />
}
