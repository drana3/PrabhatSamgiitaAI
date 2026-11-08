import { StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"

import { AuthorLine } from "@/components/authors/AuthorLine"
import { KiirtanCover } from "@/components/kirtan/KiirtanCover"
import { useRecordingPhoto } from "@/components/kirtan/useRecordingPhoto"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import type { Kirtan } from "@/lib/kirtan/types"

/** The picture takes this share of the page width (the Prabhat Samgiita page's photo is wide; a recording's cover is square). */
const PHOTO_SHARE = 0.58
const PHOTO_MAX = 280

/**
 * The top of a recording's page, built like the Prabhat Samgiita song page: a wash of the page colour, the picture, and the
 * title and performer under it. The picture is the cover, else the author's photo, else the Kiirtan's own gradient or stock
 * picture. Nothing is ever drawn ON the picture (no gradient over it, no text on it), so a photo of Baba always shows clean;
 * the soft glow is the same picture blurred BEHIND it. Depth is made of layers, not of a shadow.
 */
export function RecordingHero({ theme, kirtan }: { theme: SongsTheme; kirtan: Kirtan }) {
  const t = useT()
  const { width } = useWindowDimensions()
  const photo = useRecordingPhoto(kirtan)
  const size = Math.round(Math.min(PHOTO_MAX, Math.min(width, 640) * PHOTO_SHARE))
  return (
    <View style={s.root} testID="recording-hero">
      <View style={s.stage}>
        <LinearGradient pointerEvents="none" colors={[theme.page, theme.peach, theme.page]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
        {photo ? <Image source={{ uri: photo }} blurRadius={48} contentFit="cover" accessibilityIgnoresInvertColors style={[s.glow, { opacity: 0.35 }]} /> : null}
        <View style={s.cover} accessible accessibilityRole="image" accessibilityLabel={t("recPage.photo.a11y", { title: kirtan.title })}>
          <KiirtanCover type={kirtan.type} kind={kirtan.kind} coverUrl={photo} width={size} height={size} radius={24} photoSeed={kirtan.id} title={kirtan.title} durationSec={kirtan.durationSec} />
        </View>
      </View>
      <View style={s.text}>
        <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">
          {kirtan.title}
        </Text>
        {kirtan.author ? <Text style={[s.author, { color: theme.textHeading }]}>{kirtan.author}</Text> : null}
        <AuthorLine theme={theme} recordingId={kirtan.serverId ?? kirtan.id} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 16 },
  stage: { alignItems: "center", paddingTop: 16, paddingBottom: 24, overflow: "hidden" },
  glow: { position: "absolute", top: 0, left: -48, right: -48, bottom: 0 },
  cover: { zIndex: 1 },
  text: { gap: 8, paddingHorizontal: 20 },
  h1: { fontFamily: amFonts.display, fontSize: 40, lineHeight: 42, letterSpacing: -0.8, textTransform: "uppercase" },
  author: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
})
