import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
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
  const source = uri && /^https?:\/\//i.test(uri) ? { uri } : brandAssets.dawn
  const recyclingKey = typeof source === "object" && "uri" in source ? source.uri : "dawn"

  if (Platform.OS === "android") {
    return (
      <>
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceWarm }, style as StyleProp<ViewStyle>]}
        />
        <Image
          source={source}
          style={style}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority={priority}
          recyclingKey={recyclingKey}
          placeholder={brandAssets.dawn}
          placeholderContentFit="cover"
          transition={0}
        />
      </>
    )
  }

  return (
    <>
      <LinearGradient
        colors={[colors.surfaceWarm, "#8B7355"]}
        style={[StyleSheet.absoluteFill, style as StyleProp<ViewStyle>]}
      />
      <Image
        source={source}
        style={style}
        contentFit="cover"
        cachePolicy="memory-disk"
        priority={priority}
        recyclingKey={recyclingKey}
        placeholder={brandAssets.dawn}
        placeholderContentFit="cover"
        transition={120}
      />
      <LinearGradient colors={gradient} style={[StyleSheet.absoluteFill, style as StyleProp<ViewStyle>]} />
    </>
  )
}
