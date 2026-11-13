import type { ReactElement } from "react"

import { CARD_FORMATS, GOLD, INK, IVORY, type CardFormat } from "@/lib/author-card"
import { songCardLine, songCardTitle, songEyebrow, type CardSong } from "@/lib/song-card"

/**
 * The picture of a song page, as the element tree the image renderer (next/og) draws: the warm stock photo of the
 * author cards, a black scrim under the text, a gold hairline, a small line "Prabhat Samgiita · Song 1234", the
 * title in capitals (Gloock), the first line in DM Mono. Nothing else: no address, no numbers of listeners.
 */
export const SONG_DISPLAY_FONT = "Gloock"
export const SONG_MONO_FONT = "DM Mono"

export function songTitleSize(title: string, format: CardFormat): number {
  const wide = format === "link"
  const base = wide ? 84 : 96
  const min = wide ? 44 : 56
  if (title.length <= 18) return base
  if (title.length <= 36) return Math.round(base * 0.78)
  if (title.length <= 56) return Math.round(base * 0.62)
  return min
}

export function songCardElement({ song, format, background }: { song: CardSong; format: CardFormat; background: string }): ReactElement {
  const { width, height } = CARD_FORMATS[format]
  const wide = format === "link"
  const pad = wide ? 64 : 80
  const safeBottom = format === "story" ? 220 : 0
  const title = songCardTitle(song)
  const line = songCardLine(song)
  const size = songTitleSize(title, format)
  const eyebrowSize = wide ? 24 : 30
  const lineSize = wide ? 28 : 34
  const scrim =
    "linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.28) 38%, rgba(0,0,0,0.62) 62%, rgba(0,0,0,0.88) 100%)"

  return (
    <div style={{ width, height, display: "flex", position: "relative", backgroundColor: INK }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={background} width={width} height={height} style={{ position: "absolute", left: 0, top: 0, width, height, objectFit: "cover" }} />
      <div style={{ position: "absolute", left: 0, top: 0, width, height, display: "flex", backgroundImage: scrim }} />
      <div style={{ position: "absolute", left: pad, right: pad, bottom: pad + safeBottom, display: "flex", flexDirection: "column" }}>
        <div style={{ width: 72, height: 4, backgroundColor: GOLD, marginBottom: Math.round(eyebrowSize * 0.9) }} />
        <div style={{ display: "flex", fontFamily: SONG_MONO_FONT, fontSize: eyebrowSize, letterSpacing: eyebrowSize * 0.12, textTransform: "uppercase", color: GOLD }}>
          {songEyebrow(song)}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: Math.round(eyebrowSize * 0.5),
            fontFamily: SONG_DISPLAY_FONT,
            fontSize: size,
            lineHeight: 1.02,
            letterSpacing: -size * 0.01,
            textTransform: "uppercase",
            color: IVORY,
            lineClamp: wide ? 2 : 3,
          }}
        >
          {title}
        </div>
        {line ? (
          <div style={{ display: "flex", marginTop: Math.round(lineSize * 0.7), fontFamily: SONG_MONO_FONT, fontSize: lineSize, letterSpacing: lineSize * 0.04, color: "rgba(251,246,236,0.86)", lineClamp: 2 }}>
            {line}
          </div>
        ) : null}
      </div>
    </div>
  )
}
