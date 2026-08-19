import { StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import { Image, type ImageStyle } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"

import { brandAssets } from "@/constants/brand"
import { colors } from "@/constants/colors"

type Props = {
  uri: string
  style?: StyleProp<ImageStyle>
  priority?: "low" | "normal" | "high"
}

const gradient = ["rgba(20,14,10,0.12)", "rgba(20,14,10,0.78)"] as const

export function ScenicBackgroundImage({ uri, style, priority = "normal" }: Props) {
  return (
    <>
      <LinearGradient
        colors={[colors.surfaceWarm, "#8B7355"]}
        style={[StyleSheet.absoluteFill, style as StyleProp<ViewStyle>]}
      />
      <Image
        source={{ uri }}
        style={style}
        contentFit="cover"
        cachePolicy="memory-disk"
        priority={priority}
        recyclingKey={uri}
        placeholder={brandAssets.dawn}
        placeholderContentFit="cover"
        transition={120}
      />
      <LinearGradient colors={gradient} style={[StyleSheet.absoluteFill, style as StyleProp<ViewStyle>]} />
    </>
  )
}
