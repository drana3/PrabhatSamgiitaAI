import { StyleSheet, Text, View } from "react-native"
import { Image as ExpoImage } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"

import { SpActionRow } from "@/components/song-v2/SpHero"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { formatDate, useLanguage } from "@/lib/i18n"
import { toSentenceCase } from "@/lib/songPage/scripts"

import { useBarHeight } from "./Shell"
import { withAlpha } from "./ui"
import type { SongVariantModel } from "./useSongVariantModel"

export const PHOTO_HEIGHT = 214

export function songTitle(model: SongVariantModel): string {
  return model.song ? toSentenceCase(model.song.title) : ""
}

/** `Shrii P. R. Sarkar · 17 September 1982`: only what the catalogue states. */
export function useHeadline(model: SongVariantModel): string {
  useLanguage()
  const words = model.about.find((row) => row.id === "words")
  const composed = model.about.find((row) => row.id === "composed")
  const parts: string[] = []
  if (words && words.id === "words") parts.push(words.value)
  if (composed && composed.id === "composed") parts.push(formatDate(new Date(composed.date.year, composed.date.month - 1, composed.date.day), "long"))
  return parts.join(" · ")
}

/** The one action row of the page (Save, Download, Playlist, Share, More, Play), the app's own. */
export function Actions({ t, model }: { t: SpTheme; model: SongVariantModel }) {
  return (
    <SpActionRow
      t={t}
      saveItem={model.saveItem}
      downloadItem={model.downloadItem}
      onPlaylist={() => model.onAction("playlist")}
      onShare={() => model.setSheet("share")}
      onMore={() => model.setSheet("actions")}
      playing={model.showPause}
      onPlay={model.handlePlay}
    />
  )
}

function Photo({ model, height }: { model: SongVariantModel; height: number }) {
  if (!model.photo) return <View style={{ height }} />
  return (
    <ExpoImage
      source={model.photo.cover}
      contentFit="cover"
      transition={160}
      accessibilityLabel=""
      style={{ position: "absolute", top: 0, left: 0, right: 0, height }}
    />
  )
}

/** Variant A: a photo banner with the title on it, over a scrim. */
export function BannerHero({ t, model }: { t: SpTheme; model: SongVariantModel }) {
  const bar = useBarHeight()
  const height = bar + 154
  const headline = useHeadline(model)
  return (
    <View style={{ height }}>
      <Photo model={model} height={height} />
      <LinearGradient pointerEvents="none" colors={["rgba(20,16,12,0.15)", "rgba(20,16,12,0.78)"]} locations={[0.25, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.bannerText}>
        <Text style={styles.bannerEyebrow}>{`PS ${model.song?.number ?? ""}`}</Text>
        <Text style={styles.bannerTitle} numberOfLines={3}>{songTitle(model)}</Text>
        {headline ? <Text style={styles.bannerSub} numberOfLines={2}>{headline}</Text> : null}
      </View>
    </View>
  )
}
export function bannerHeight(bar: number): number {
  return bar + 154
}

/** Variant B: a tall photo that fades into the page, the title below it. */
export function FadeHero({ t, model }: { t: SpTheme; model: SongVariantModel }) {
  const bar = useBarHeight()
  const height = bar + PHOTO_HEIGHT - 52
  const headline = useHeadline(model)
  return (
    <View>
      <View style={{ height }}>
        <Photo model={model} height={height} />
        <LinearGradient pointerEvents="none" colors={["rgba(20,16,12,0.30)", "rgba(20,16,12,0)"]} locations={[0, 0.4]} style={StyleSheet.absoluteFill} />
        <LinearGradient pointerEvents="none" colors={[withAlpha(t.sand200, 0), t.sand200]} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.fadeText}>
        <Text style={[styles.eyebrow, { color: t.ink500 }]}>{`PS ${model.song?.number ?? ""}`}</Text>
        <Text style={[styles.title, { color: t.ink900 }]}>{songTitle(model)}</Text>
        {headline ? <Text style={[styles.sub, { color: t.ink500 }]}>{headline}</Text> : null}
      </View>
    </View>
  )
}
export function fadeHeight(bar: number): number {
  return bar + PHOTO_HEIGHT - 52 + 96
}

/** Variant C: a compact header with a small photo, nothing tall. */
export function ThumbHero({ t, model }: { t: SpTheme; model: SongVariantModel }) {
  const headline = useHeadline(model)
  return (
    <View style={styles.thumbRow}>
      <View style={[styles.thumb, { backgroundColor: t.sand300 }]}>
        {model.photo ? <ExpoImage source={model.photo.thumb} contentFit="cover" style={StyleSheet.absoluteFill} accessibilityLabel="" /> : null}
      </View>
      <View style={styles.thumbText}>
        <Text style={[styles.eyebrow, { color: t.ink500 }]}>{`PS ${model.song?.number ?? ""}`}</Text>
        <Text style={[styles.thumbTitle, { color: t.ink900 }]} numberOfLines={3}>{songTitle(model)}</Text>
        {headline ? <Text style={[styles.sub, { color: t.ink500 }]} numberOfLines={2}>{headline}</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bannerText: { position: "absolute", left: 20, right: 20, bottom: 16, gap: 2 },
  bannerEyebrow: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, color: "rgba(255,255,255,0.86)" },
  bannerTitle: { fontFamily: amFonts.display, fontSize: 32, lineHeight: 36, color: "#FFFFFF" },
  bannerSub: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20, color: "rgba(255,255,255,0.86)", paddingTop: 2 },
  fadeText: { paddingHorizontal: 20, marginTop: -44, gap: 4 },
  eyebrow: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 1.04 },
  title: { fontFamily: amFonts.display, fontSize: 34, lineHeight: 38 },
  sub: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20 },
  thumbRow: { flexDirection: "row", gap: 16, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, alignItems: "center" },
  thumb: { width: 92, height: 92, borderRadius: 20, overflow: "hidden" },
  thumbText: { flex: 1, gap: 3 },
  thumbTitle: { fontFamily: amFonts.display, fontSize: 26, lineHeight: 30 },
})
