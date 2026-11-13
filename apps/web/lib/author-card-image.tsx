import type { ReactElement } from "react"

import {
  CARD_FORMATS,
  GOLD,
  INK,
  IVORY,
  cardEyebrow,
  cardInitials,
  cardKindsLine,
  cardLayout,
  cardName,
  cardNameSize,
  isDrawableName,
  placeholderGradient,
  scrimStops,
  type CardFormat,
  type CardProfile,
} from "@/lib/author-card"

/**
 * The picture of an author page, as the element tree the image renderer (next/og, Satori) draws.
 * Variant 1 of Dada's board, "like the song": a warm photo from the catalogue behind everything, a black scrim
 * under the text, the author's round photo (or a round placeholder with initials), a gold hairline, a small line
 * "Singer · Warsaw, Poland", the name in capitals, the kinds of recordings. Nothing else: no address of the site, no
 * number of listeners, no line at the bottom. Fonts: Gloock for the name, DM Mono for the small lines.
 */
export const DISPLAY_FONT = "Gloock"
export const MONO_FONT = "DM Mono"

type Input = {
  profile: CardProfile
  format: CardFormat
  /** `data:` URI of the stock photo behind the card */
  background: string
  /** `data:` URI of the author's own photo, when there is one the renderer can draw */
  photo: string | null
}

export function authorCardElement({ profile, format, background, photo }: Input): ReactElement {
  const { width, height } = CARD_FORMATS[format]
  const l = cardLayout(format)
  const name = cardName(profile)
  const drawable = isDrawableName(name)
  const shownName = drawable ? name : "Author page"
  const size = cardNameSize(shownName, format)
  const eyebrow = cardEyebrow(profile)
  const kinds = cardKindsLine(profile)
  const stops = scrimStops(format)
  const scrim = `linear-gradient(to bottom, ${stops.map((s) => `rgba(0,0,0,${s.alpha}) ${Math.round(s.at * 100)}%`).join(", ")})`
  const ph = placeholderGradient(profile.id)
  const wide = l.direction === "row"

  const portrait = photo ? (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img src={photo} width={l.portrait} height={l.portrait} style={{ width: l.portrait, height: l.portrait, flexShrink: 0, borderRadius: l.portrait, objectFit: "cover", border: `4px solid ${IVORY}` }} />
  ) : (
    <div
      style={{
        width: l.portrait,
        height: l.portrait,
        flexShrink: 0,
        borderRadius: l.portrait,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: `linear-gradient(145deg, ${ph.from}, ${ph.to})`,
        border: `4px solid rgba(251,246,236,0.85)`,
        color: IVORY,
        fontFamily: DISPLAY_FONT,
        fontSize: Math.round(l.portrait * 0.4),
        letterSpacing: 2,
      }}
    >
      {drawable ? cardInitials(name) : ""}
    </div>
  )

  const text = (
    <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
      <div style={{ width: 72, height: 4, backgroundColor: GOLD, marginBottom: Math.round(l.eyebrowSize * 0.9) }} />
      <div style={{ display: "flex", fontFamily: MONO_FONT, fontSize: l.eyebrowSize, letterSpacing: l.eyebrowSize * 0.12, textTransform: "uppercase", color: GOLD }}>{eyebrow}</div>
      <div
        style={{
          display: "flex",
          marginTop: Math.round(l.eyebrowSize * 0.5),
          fontFamily: DISPLAY_FONT,
          fontSize: size,
          lineHeight: 1.02,
          letterSpacing: -size * 0.01,
          textTransform: "uppercase",
          color: IVORY,
          lineClamp: l.nameLines,
        }}
      >
        {shownName}
      </div>
      {kinds ? (
        <div style={{ display: "flex", marginTop: Math.round(l.kindsSize * 0.7), fontFamily: MONO_FONT, fontSize: l.kindsSize, letterSpacing: l.kindsSize * 0.06, color: "rgba(251,246,236,0.86)" }}>{kinds}</div>
      ) : null}
    </div>
  )

  return (
    <div style={{ width, height, display: "flex", position: "relative", backgroundColor: INK }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={background} width={width} height={height} style={{ position: "absolute", left: 0, top: 0, width, height, objectFit: "cover" }} />
      <div style={{ position: "absolute", left: 0, top: 0, width, height, display: "flex", backgroundImage: scrim }} />
      <div style={{ position: "absolute", left: 0, top: 0, width, height, display: "flex", backgroundImage: "radial-gradient(circle at 12% 96%, rgba(226,185,85,0.16), rgba(226,185,85,0) 52%)" }} />
      <div
        style={{
          position: "absolute",
          left: l.padding,
          right: l.padding,
          bottom: l.padding + l.safeBottom,
          display: "flex",
          flexDirection: wide ? "row" : "column",
          alignItems: wide ? "flex-end" : "flex-start",
          gap: wide ? 44 : Math.round(l.portrait * 0.14),
        }}
      >
        {portrait}
        {text}
      </div>
    </div>
  )
}
