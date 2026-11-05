import { useEffect, useState } from "react"
import { StyleSheet, View, type DimensionValue } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import Svg, { Path } from "react-native-svg"

import { BHAJAN_OTHER_TONE, KIIRTAN_TYPE_TONES, kiirtanTone, kindTone } from "@/lib/kirtan/tone"
import { moodForText, photoForSeed, type PhotoMood } from "@/lib/photos/catalog"

// The gradients per type and kind live in lib/kirtan/tone.ts (pure, tested); re-exported so callers keep their import.
export { BHAJAN_OTHER_TONE, KIIRTAN_TYPE_TONES, kiirtanTone, kindTone }

/** Five vertical bars of different height: a sound wave. */
export function WaveGlyph({ size = 24, color = "#FFFFFF", strokeWidth = 2 }: { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Path d="M4 10v4M8 6.5v11M12 3.5v17M16 7v10M20 10v4" />
    </Svg>
  )
}

/**
 * The picture of a Kiirtan or Bhajan: the author's cover when there is one, otherwise a gradient that
 * belongs to its TYPE and kind (so the same colours run through the tab, the rows, the pill and the
 * player), or a stock photo. A sound-wave glyph sits on the gradient.
 */
type Props = {
  type: string | null | undefined
  /** "bhajan" picks the Bhajan gradients; anything else is a Kiirtan */
  kind?: string | null
  coverUrl?: string | null
  width: DimensionValue
  height?: number
  aspectRatio?: number
  radius: number
  /** pixel size of the glyph; derived from the width when it is a number */
  glyph?: number
  /**
   * Without an author cover: a stock photo that is the same every time for this seed (the Kiirtan's id),
   * instead of the gradient. Keep passing `title` / `durationSec` so the mood (morning, night, long...) fits.
   */
  photoSeed?: string
  title?: string
  durationSec?: number | null
  photoMood?: PhotoMood
  /**
   * Called once when the picture that shows (the cover, or the stock photo) has loaded or failed, or at once when
   * only the gradient shows. The share card waits for it before it takes its picture.
   */
  onSettled?: () => void
}

export function KiirtanCover({ type, kind, coverUrl, width, height, aspectRatio, radius, glyph, photoSeed, title, durationSec, photoMood, onSettled }: Props) {
  const [failed, setFailed] = useState(false)
  const [from, to] = kiirtanTone(type, kind)
  const basis = typeof width === "number" ? Math.min(width, height ?? width) : 120
  const size = glyph ?? Math.max(16, Math.round(basis * 0.42))
  const showImage = Boolean(coverUrl) && !failed
  const photo = photoSeed && !showImage ? photoForSeed(photoSeed, photoMood ?? (title ? moodForText(title, durationSec) : undefined)) : null
  const photoSource = photo ? (basis <= 240 ? photo.thumb : photo.cover) : null
  // nothing to wait for when only the gradient shows
  useEffect(() => {
    if (!photoSource && !showImage) onSettled?.()
  }, [photoSource, showImage, onSettled])
  return (
    <View style={{ width, height, aspectRatio, borderRadius: radius, overflow: "hidden" }}>
      <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {photoSource ? (
        <Image source={photoSource} contentFit="cover" accessibilityIgnoresInvertColors onLoad={onSettled} onError={onSettled} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={styles.center}>
          <WaveGlyph size={size} color="rgba(255,255,255,0.86)" strokeWidth={size > 40 ? 1.6 : 2} />
        </View>
      )}
      {showImage ? (
        <Image source={{ uri: coverUrl as string }} contentFit="cover" accessibilityIgnoresInvertColors onLoad={onSettled} onError={() => { setFailed(true); onSettled?.() }} style={StyleSheet.absoluteFill} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
})
