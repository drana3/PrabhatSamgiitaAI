import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native"
import { Image } from "expo-image"

import { BABA_PHOTOS, cropFits, type BabaPhotoId } from "@/lib/photos/baba"

type Props = {
  id: BabaPhotoId
  /** width / height of the frame; the face is guaranteed to stay inside the crop (checked in dev) */
  ratio?: number
  radius?: number
  /** the line under the picture, never over it */
  caption?: string
  captionColor?: string
  /** colour behind a `contain` picture */
  backdrop?: string
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  /** deliberately absent: nothing is drawn over a photo of Baba */
  children?: never
}

/**
 * The one way to show a photograph of Baba: a clean frame, no scrim, no opacity, nothing on top, the whole
 * face in the crop. Text, chips and buttons go beside or below it (`caption` is rendered below the frame).
 * See docs/photo-system.md, "Baba photos".
 */
export function BabaPhoto({ id, ratio = 1.2, radius = 24, caption, captionColor = "#5A524B", backdrop = "#1a2433", style, accessibilityLabel }: Props) {
  const meta = BABA_PHOTOS[id]
  if (__DEV__ && !cropFits(meta, ratio)) {
    console.warn(`BabaPhoto "${id}": ratio ${ratio} crops through the face; use a taller frame`)
  }
  return (
    <View style={style}>
      <View style={[s.frame, { aspectRatio: ratio, borderRadius: radius, backgroundColor: meta.fit === "contain" ? backdrop : "transparent" }]}>
        <Image
          source={meta.source}
          style={StyleSheet.absoluteFill}
          contentFit={meta.fit}
          contentPosition={meta.anchor}
          accessibilityLabel={accessibilityLabel ?? meta.alt}
          accessibilityIgnoresInvertColors
        />
      </View>
      {caption ? <Text style={[s.caption, { color: captionColor }]}>{caption}</Text> : null}
    </View>
  )
}

const s = StyleSheet.create({
  frame: { width: "100%", overflow: "hidden" },
  caption: { marginTop: 8, fontSize: 13, lineHeight: 18 },
})
