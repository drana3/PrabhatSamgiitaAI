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
import type { SongPageModel } from "./useSongPageModel"

export const PHOTO_HEIGHT = 214

export function songTitle(model: SongPageModel): string {
  return model.song ? toSentenceCase(model.song.title) : ""
}

/** `Shrii P. R. Sarkar · 17 September 1982`: only what the catalogue states. */
export function useHeadline(model: SongPageModel): string {
  useLanguage()
  const words = model.about.find((row) => row.id === "words")
  const composed = model.about.find((row) => row.id === "composed")
  const parts: string[] = []
  if (words && words.id === "words") parts.push(words.value)
  if (composed && composed.id === "composed") parts.push(formatDate(new Date(composed.date.year, composed.date.month - 1, composed.date.day), "long"))
  return parts.join(" · ")
}

/** The one action row of the page (Save, Download, Playlist, Share, More, Play), the app's own. */
export function Actions({ t, model }: { t: SpTheme; model: SongPageModel }) {
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

function Photo({ model, height }: { model: SongPageModel; height: number }) {
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

/** A tall photo that fades into the page, the title and the PS number below it. */
export function FadeHero({ t, model }: { t: SpTheme; model: SongPageModel }) {
  const bar = useBarHeight()
  const height = bar + PHOTO_HEIGHT - 52
  const headline = useHeadline(model)
  return (
    <View>
      <View style={{ height }}>
        <Photo model={model} height={height} />
        <LinearGradient pointerEvents="none" colors={["rgba(20,16,12,0.62)", "rgba(20,16,12,0)"]} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
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

const styles = StyleSheet.create({
  fadeText: { paddingHorizontal: 20, marginTop: -44, gap: 4 },
  eyebrow: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 1.04 },
  title: { fontFamily: amFonts.display, fontSize: 34, lineHeight: 38 },
  sub: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20 },
})
