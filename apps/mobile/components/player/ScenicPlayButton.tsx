import { useRef } from "react"
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { Pause, Play } from "lucide-react-native"

import { brandAssets } from "@/constants/brand"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius } from "@/constants/spacing"

type Size = "sm" | "md" | "lg" | "hero"

const dims: Record<Size, number> = {
  sm: 52,
  md: 72,
  lg: 96,
  hero: 160,
}

type Props = {
  imageUrl?: string
  size?: Size
  onPress: () => void
  accessibilityLabel: string
  style?: StyleProp<ViewStyle>
  isPlaying?: boolean
}

/**
 * Play control that always lives on sunrise / nature scenery.
 * Never render a bare orange play circle without art.
 */
export function ScenicPlayButton({
  imageUrl,
  size = "md",
  onPress,
  accessibilityLabel,
  style,
  isPlaying = false,
}: Props) {
  const dim = dims[size]
  const playSize = size === "sm" ? 14 : size === "md" ? 18 : size === "lg" ? 22 : 28
  const source = imageUrl ? { uri: imageUrl } : brandAssets.dawn
  const lastFire = useRef(0)
  const fire = () => {
    const now = Date.now()
    if (now - lastFire.current < 350) return
    lastFire.current = now
    onPress()
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Starts audio playback"
      onPress={fire}
      onPressIn={fire}
      style={({ pressed }) => [
        {
          width: dim,
          height: dim,
          borderRadius: size === "hero" ? radius.xl : radius.lg,
          overflow: "hidden",
          backgroundColor: colors.surfaceWarm,
          ...softShadow(1),
        },
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.95 },
        style,
      ]}
    >
      <Image source={source} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      <LinearGradient
        colors={["rgba(20,14,10,0.05)", "rgba(20,14,10,0.45)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.playCenter}>
        <View
          style={[
            styles.playDisc,
            {
              width: playSize * 2.2,
              height: playSize * 2.2,
              borderRadius: playSize * 1.1,
            },
          ]}
        >
          {isPlaying ? (
            <Pause size={playSize} color={colors.white} fill={colors.white} />
          ) : (
            <Play size={playSize} color={colors.white} fill={colors.white} />
          )}
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  playCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playDisc: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
})
