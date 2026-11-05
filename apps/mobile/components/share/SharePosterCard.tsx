import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"

import { KiirtanCover } from "@/components/kirtan/KiirtanCover"
import { amFonts } from "@/constants/tokens/amTypography"
import { photoForSeed } from "@/lib/photos/catalog"
import {
  CARD_PHOTO_OPTIONS,
  cardEyebrow,
  cardLayout,
  cardPhotoSeed,
  cardScrimStops,
  cardSize,
  cardSubline,
  cardTitle,
  cardTitleLineHeight,
  cardTitleSize,
  cardUrlLine,
  type CardFormat,
  type CardSubject,
} from "@/lib/share/card"
import { webBaseUrl } from "@/lib/webLinks"

const WHITE = "#FFFFFF"
const SOFT = "rgba(255, 255, 255, 0.9)"
/** Neutral dark glass behind the app mark: white text on it passes whatever the photo is (docs/photo-system.md). */
const GLASS = "rgba(20, 18, 15, 0.62)"
const ICON = require("../../assets/icon.png")

type Props = {
  subject: CardSubject
  format: CardFormat
  /** 1 draws the real 1080 px card (the one that is captured); less draws a smaller preview of it. */
  scale?: number
  /** Called when the picture behind the text has loaded (or failed, or there is none to load). */
  onSettled?: () => void
}

/**
 * The share card as a picture of 1080 x 1350 (portrait) or 1080 x 1080 (square): the song's photo (the same one
 * its page shows) or the Kiirtan's cover, an app mark in dark glass at the top left, and at the bottom, on a scrim,
 * "PS 123" or "Kiirtan · Artist", the title, the performer and the short link. Pure layout in lib/share/card.ts.
 * Photos follow the default rules: no children, no close faces, no low-resolution picture.
 */
export function SharePosterCard({ subject, format, scale = 1, onSettled }: Props) {
  const { width, height } = cardSize(format)
  const l = cardLayout(format)
  const title = cardTitle(subject)
  const eyebrow = cardEyebrow(subject)
  const subline = cardSubline(subject)
  const url = cardUrlLine(subject, webBaseUrl())
  const titleSize = cardTitleSize(title, format)
  const stops = useMemo(() => cardScrimStops(format), [format])

  // a song: the photo of its page's hero; a Kiirtan: KiirtanCover (its own cover, else a stock photo)
  const songPhoto = useMemo(() => (subject.kind === "song" ? photoForSeed(cardPhotoSeed(subject), undefined, CARD_PHOTO_OPTIONS) : null), [subject])

  const content = (
    <View style={[styles.card, { width, height }]} collapsable={false}>
      {subject.kind === "song" && songPhoto ? (
        <Image source={songPhoto.cover} contentFit="cover" accessibilityIgnoresInvertColors onLoad={onSettled} onError={onSettled} style={StyleSheet.absoluteFill} />
      ) : subject.kind === "kiirtan" ? (
        <KiirtanCover
          type={subject.type}
          kind={subject.recordingKind}
          coverUrl={subject.coverUrl}
          width={width}
          height={height}
          radius={0}
          photoSeed={cardPhotoSeed(subject)}
          title={subject.title}
          durationSec={subject.durationSec}
          onSettled={onSettled}
        />
      ) : null}

      <LinearGradient
        pointerEvents="none"
        colors={stops.map((s) => `rgba(0, 0, 0, ${s.alpha})`) as [string, string, ...string[]]}
        locations={stops.map((s) => s.at) as [number, number, ...number[]]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.mark, { top: l.padding, left: l.padding, height: l.markSize, borderRadius: l.markSize / 2 }]}>
        <Image source={ICON} contentFit="cover" accessibilityIgnoresInvertColors style={{ width: 64, height: 64, borderRadius: 16 }} />
        <Text style={styles.markText} numberOfLines={1}>
          Prabhat Samgiita
        </Text>
      </View>

      <View style={[styles.block, { left: l.padding, right: l.padding, bottom: l.padding, gap: l.gap }]}>
        <Text style={[styles.eyebrow, { fontSize: l.eyebrowSize, lineHeight: l.eyebrowSize + 8, letterSpacing: l.eyebrowTracking }]} numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text
          style={[styles.title, { fontSize: titleSize, lineHeight: cardTitleLineHeight(titleSize), letterSpacing: -titleSize * 0.02 }]}
          numberOfLines={3}
        >
          {title}
        </Text>
        {subline ? (
          <Text style={[styles.subline, { fontSize: l.sublineSize, lineHeight: l.sublineSize + 10 }]} numberOfLines={2}>
            {subline}
          </Text>
        ) : null}
        <View style={styles.rule} />
        <Text style={[styles.url, { fontSize: l.urlSize, lineHeight: l.urlSize + 8 }]} numberOfLines={1}>
          {url}
        </Text>
      </View>
    </View>
  )

  if (scale === 1) return content
  // a smaller preview: the same 1080 px card, shrunk about its centre inside a box of the smaller size
  const shiftX = -(width * (1 - scale)) / 2
  const shiftY = -(height * (1 - scale)) / 2
  return (
    <View style={{ width: width * scale, height: height * scale, overflow: "hidden" }} accessibilityLabel={`Share card: ${title}`} accessible>
      <View style={{ position: "absolute", left: 0, top: 0, width, height, transform: [{ translateX: shiftX }, { translateY: shiftY }, { scale }] }} pointerEvents="none">
        {content}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", backgroundColor: "#20281A" },
  mark: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 20, paddingLeft: 20, paddingRight: 36, backgroundColor: GLASS },
  markText: { fontFamily: amFonts.display, fontSize: 34, lineHeight: 40, letterSpacing: 3.4, textTransform: "uppercase", color: WHITE },
  block: { position: "absolute" },
  eyebrow: { fontFamily: amFonts.semi, textTransform: "uppercase", color: SOFT },
  title: { fontFamily: amFonts.display, textTransform: "uppercase", color: WHITE },
  subline: { fontFamily: amFonts.medium, color: SOFT },
  rule: { height: 2, backgroundColor: "rgba(255, 255, 255, 0.34)", marginTop: 6 },
  url: { fontFamily: amFonts.semi, color: SOFT },
})
