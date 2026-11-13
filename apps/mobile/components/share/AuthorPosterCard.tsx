import { useCallback, useMemo, useRef, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"

import { Scaled } from "@/components/share/SharePosterCard"
import { amFonts } from "@/constants/tokens/amTypography"
import { STOCK_PHOTOS } from "@/lib/photos/catalog"
import {
  AUTHOR_GOLD,
  AUTHOR_IVORY,
  authorCardLayout,
  authorCardPhotoN,
  authorInitials,
  authorNameSize,
  authorPlaceholder,
  authorScrimStops,
  cardEyebrow,
  cardSize,
  cardSubline,
  cardTitle,
  type CardFormat,
  type CardSubject,
} from "@/lib/share/card"

const INK = "#14100C"
const SOFT = "rgba(251, 246, 236, 0.86)"

type Props = {
  subject: Extract<CardSubject, { kind: "author" }>
  format: CardFormat
  /** 1 draws the real 1080 px card (the one that is captured); less draws a smaller preview of it. */
  scale?: number
  /** Called when the pictures on the card have loaded (or failed, or there are none to load). */
  onSettled?: () => void
}

/**
 * The share card of an author page: "like the song" (variant 1 of the board). A warm stock photo behind everything
 * (picked by the page id, so it is the one the website's link preview shows), a black scrim under the text, the
 * author's round photo or a round placeholder with initials, a gold hairline, "Singer · Warsaw, Poland", the name in
 * capitals and the kinds of recordings. No site name at the top, no address or line at the bottom, no number of
 * listeners: nothing a hidden statistic could leak through. In Stories (1080 x 1920) the text keeps clear of the
 * top and bottom 335 px. Layout numbers are in lib/share/card.ts.
 */
export function AuthorPosterCard({ subject, format, scale = 1, onSettled }: Props) {
  const { width, height } = cardSize(format)
  const l = authorCardLayout(format)
  const name = cardTitle(subject)
  const eyebrow = cardEyebrow(subject)
  const kinds = cardSubline(subject)
  const size = authorNameSize(name, format)
  const stops = useMemo(() => authorScrimStops(format), [format])
  const background = useMemo(() => STOCK_PHOTOS.find((p) => p.n === authorCardPhotoN(subject.id)) ?? STOCK_PHOTOS.find((p) => p.people === "none"), [subject.id])
  const ph = useMemo(() => authorPlaceholder(subject.id), [subject.id])

  // settled once the stock photo and, when there is one, the author's own photo have loaded or failed
  const [ownFailed, setOwnFailed] = useState(false)
  const pending = useRef({ background: true, own: Boolean(subject.photoUrl) })
  const done = useCallback(
    (part: "background" | "own") => {
      pending.current[part] = false
      if (!pending.current.background && !pending.current.own) onSettled?.()
    },
    [onSettled],
  )
  const showOwn = Boolean(subject.photoUrl) && !ownFailed

  const content = (
    <View style={[styles.card, { width, height }]} collapsable={false}>
      {background ? (
        <Image source={background.cover} contentFit="cover" accessibilityIgnoresInvertColors onLoad={() => done("background")} onError={() => done("background")} style={StyleSheet.absoluteFill} />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={stops.map((s) => `rgba(0, 0, 0, ${s.alpha})`) as [string, string, ...string[]]}
        locations={stops.map((s) => s.at) as [number, number, ...number[]]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.block, { left: l.padding, right: l.padding, bottom: l.padding + l.safeBottom }]}>
        {showOwn ? (
          <Image
            source={{ uri: subject.photoUrl as string }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
            onLoad={() => done("own")}
            onError={() => {
              setOwnFailed(true)
              done("own")
            }}
            style={{ width: l.avatar, height: l.avatar, borderRadius: l.avatar / 2, borderWidth: 4, borderColor: AUTHOR_IVORY }}
          />
        ) : (
          <LinearGradient
            colors={[ph.from, ph.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.placeholder, { width: l.avatar, height: l.avatar, borderRadius: l.avatar / 2 }]}
          >
            <Text style={[styles.initials, { fontSize: Math.round(l.avatar * 0.4) }]}>{authorInitials(subject.name)}</Text>
          </LinearGradient>
        )}
        <View style={{ height: l.avatarGap }} />
        <View style={styles.hairline} />
        <Text style={[styles.eyebrow, { fontSize: l.eyebrowSize, lineHeight: l.eyebrowSize + 8, letterSpacing: l.eyebrowSize * 0.1, marginTop: Math.round(l.eyebrowSize * 0.9) }]} numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text style={[styles.name, { fontSize: size, lineHeight: Math.round(size * 1.02), letterSpacing: -size * 0.01, marginTop: 12 }]} numberOfLines={l.nameLines}>
          {name}
        </Text>
        {kinds ? (
          <Text style={[styles.kinds, { fontSize: l.kindsSize, lineHeight: l.kindsSize + 8, marginTop: Math.round(l.kindsSize * 0.7) }]} numberOfLines={1}>
            {kinds}
          </Text>
        ) : null}
      </View>
    </View>
  )

  return (
    <Scaled width={width} height={height} scale={scale} label={name}>
      {content}
    </Scaled>
  )
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", backgroundColor: INK },
  block: { position: "absolute", alignItems: "flex-start" },
  placeholder: { alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "rgba(251, 246, 236, 0.85)" },
  initials: { fontFamily: amFonts.display, color: AUTHOR_IVORY, letterSpacing: 2 },
  hairline: { width: 72, height: 4, backgroundColor: AUTHOR_GOLD },
  eyebrow: { fontFamily: amFonts.semi, textTransform: "uppercase", color: AUTHOR_GOLD },
  name: { fontFamily: amFonts.display, textTransform: "uppercase", color: AUTHOR_IVORY },
  kinds: { fontFamily: amFonts.medium, color: SOFT },
})
