import { Image } from "expo-image"
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native"

import { pickAvatarPhoto, useProfileStore } from "@/stores/profileStore"

/**
 * What sits inside a round avatar: the person's picture, or their initial in the screen's own text
 * style. The circle (size, fill, press) stays the caller's; the picture fills it and the circle clips it.
 */
export function AvatarFace({
  initial,
  textStyle,
  photoUri,
  size,
}: {
  initial: string
  textStyle: StyleProp<TextStyle>
  /** pass it when the caller already has the picture (the profile sheet); otherwise the saved one is read */
  photoUri?: string | null
  /** circle diameter, when the picture must be rounded by itself */
  size?: number
}) {
  const saved = useProfileStore(pickAvatarPhoto)
  const uri = photoUri === undefined ? saved : photoUri
  if (!uri) return <Text style={textStyle}>{initial}</Text>
  return (
    <Image
      source={{ uri }}
      accessibilityIgnoresInvertColors
      contentFit="cover"
      contentPosition="center"
      style={size ? { width: size, height: size, borderRadius: size / 2 } : styles.fill}
    />
  )
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, borderRadius: 9999 },
})
