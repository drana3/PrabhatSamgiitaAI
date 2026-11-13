import { StyleSheet, View, useWindowDimensions } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"

import { BabaPhoto } from "@/components/common/BabaPhoto"
import { playerColors } from "@/components/player-v2/playerTokens"
import { useT } from "@/lib/i18n"
import { cropFits, BABA_GEOMETRY } from "@/lib/photos/babaData"
import { moodForText, photoWithoutPeople } from "@/lib/photos/catalog"
import type { RadioArt } from "@/lib/radio/radioArt"

/**
 * The picture at the top of the Radio player (variant D): the record's cover, else the author's photo, else a stock photo
 * without people (lib/radio/radioArt.ts). It fills the top and fades into the dark block under it; the channel row sits on it.
 * Not used for Baba's discourses: those use `RadioBabaFrame` (a clean photograph, nothing over it).
 */
export function RadioHero({ art, title, durationSec, height }: { art: Exclude<RadioArt, { kind: "baba" }>; title: string; durationSec: number | null; height: number }) {
  const t = useT()
  const source = art.kind === "stock" ? photoWithoutPeople(art.seed, moodForText(title, durationSec)).cover : { uri: art.uri }
  return (
    <View pointerEvents="none" style={[styles.hero, { height }]} accessible accessibilityRole="image" accessibilityLabel={t("radio.player.photo.a11y")}>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" accessibilityIgnoresInvertColors />
      {/* a top scrim keeps the white channel pills readable on a bright photo; the bottom fade meets the dark block */}
      <LinearGradient colors={["rgba(18,17,16,0.55)", "rgba(18,17,16,0)"]} locations={[0, 0.4]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["rgba(18,17,16,0)", playerColors.ground]}
        locations={[0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  )
}

/** A clean photograph of Baba under the channel row: no scrim, no text, no buttons over it (docs/photo-system.md). */
export function RadioBabaFrame({ height }: { height: number }) {
  const { width } = useWindowDimensions()
  // a frame that keeps the face: never wider than the picture allows
  const wanted = Math.min(1.8, width / Math.max(120, height))
  const ratio = cropFits(BABA_GEOMETRY.today, wanted) ? wanted : 1
  return (
    <View style={styles.baba}>
      <BabaPhoto id="today" ratio={ratio} radius={0} />
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { position: "absolute", top: 0, left: 0, right: 0 },
  baba: { width: "100%", alignItems: "center", overflow: "hidden" },
})
