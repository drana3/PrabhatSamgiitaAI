import { StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"

import { coverFor } from "@/components/player-v2/playerCovers"
import { amFonts } from "@/constants/tokens/amTypography"
import { hexAlpha, tintForSong } from "@/lib/playerV2/coverTint"
import { PHOTO_SCRIM_ALPHA, sharePalette, type ShareBackground, type ShareMode } from "@/lib/playerV2/playerShare"

type Props = {
  songNumber: number
  title: string
  performer: string
  background: ShareBackground
  mode: ShareMode
  /** The stock photo behind the "photo" ground (expo-image source). */
  photo?: number | null
  /** Kiirtan items: their own cover picture (a stock photo) and tone instead of the song cover's, and no "PS" number. */
  kiirtanCover?: number | null
  tint?: string
  /** The lines of the Words card. */
  words?: readonly string[]
  /** Card width; the height follows (9:16). */
  width: number
}

const DEVANAGARI = /[ऀ-ॿ]/

/**
 * The song as a portrait poster, 9:16: a colour or photo ground, the cover as a smaller card, title,
 * performer and the "Prabhat Samgiita" wordmark at the bottom. "Words" swaps the cover for three or four
 * lyric lines. Text is white and sits on a ground (or a dark scrim over the photo) that keeps 4.5:1.
 * The poster is shown, not rendered to a picture: react-native-view-shot is not a dependency of the app,
 * so what leaves the phone is the song link and a message (the lyric lines, for Words).
 * TODO(native): render this view to a PNG once a capture library is added, and attach it to the share.
 */
export function ShareCard({ songNumber, title, performer, background, mode, photo, kiirtanCover, tint, words = [], width }: Props) {
  const s = width / 200
  const height = Math.round((width * 16) / 9)
  const pal = sharePalette(background, tint ?? tintForSong(songNumber))
  const pad = Math.round(16 * s)
  const showPhoto = background === "photo" && photo != null
  const own = coverFor(songNumber)
  const cover = kiirtanCover != null ? { source: kiirtanCover, position: { top: "50%", left: "50%" } as const } : own
  const numberText = kiirtanCover != null ? "" : `PS ${songNumber}`
  const coverSize = Math.round(width * 0.66)

  return (
    <View style={[styles.card, { width, height, borderRadius: Math.round(22 * s) }]} accessibilityLabel={`Share card: ${title}, ${performer}`}>
      {showPhoto ? (
        <>
          <Image source={photo} contentFit="cover" style={StyleSheet.absoluteFill} />
          <LinearGradient
            pointerEvents="none"
            colors={
              mode === "words"
                ? [hexAlpha("#000000", PHOTO_SCRIM_ALPHA), hexAlpha("#000000", PHOTO_SCRIM_ALPHA)]
                : [hexAlpha("#000000", 0.28), hexAlpha("#000000", PHOTO_SCRIM_ALPHA), hexAlpha("#000000", 0.74)]
            }
            locations={mode === "words" ? [0, 1] : [0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <LinearGradient colors={[pal.from, pal.to]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      )}

      {mode === "song" ? (
        <View style={[styles.inner, { padding: pad, paddingTop: Math.round(26 * s) }]}>
          <View style={[styles.coverWrap, { width: coverSize, height: coverSize, borderRadius: Math.round(12 * s) }]}>
            <Image source={cover.source} contentFit="cover" contentPosition={cover.position} style={StyleSheet.absoluteFill} />
          </View>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: pal.text, fontSize: 19 * s, lineHeight: 21 * s, letterSpacing: -0.38 * s }]} numberOfLines={3}>
              {title}
            </Text>
            <Text style={[styles.performer, { color: pal.sub, fontSize: 12.5 * s, lineHeight: 17 * s, marginTop: 6 * s }]} numberOfLines={2}>
              {performer}
            </Text>
          </View>
          <Wordmark pal={pal} s={s} numberText={numberText} />
        </View>
      ) : (
        <View style={[styles.inner, { padding: pad, paddingTop: Math.round(24 * s) }]}>
          <View style={styles.words}>
            {words.map((line, i) => (
              <Text
                key={i}
                style={[
                  DEVANAGARI.test(line) ? styles.wordsDeva : styles.wordsRoman,
                  { color: pal.text, fontSize: 17.5 * s, lineHeight: 25 * s },
                ]}
              >
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.byRow}>
            <View style={[styles.miniCover, { width: 34 * s, height: 34 * s, borderRadius: 7 * s }]}>
              <Image source={cover.source} contentFit="cover" contentPosition={cover.position} style={StyleSheet.absoluteFill} />
            </View>
            <View style={styles.byText}>
              <Text style={[styles.byTitle, { color: pal.text, fontSize: 11.5 * s, lineHeight: 14 * s }]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[styles.performer, styles.left, { color: pal.sub, fontSize: 10.5 * s, lineHeight: 14 * s }]} numberOfLines={1}>
                {performer}
              </Text>
            </View>
          </View>
          <Wordmark pal={pal} s={s} numberText={numberText} />
        </View>
      )}
    </View>
  )
}

function Wordmark({ pal, s, numberText }: { pal: ReturnType<typeof sharePalette>; s: number; numberText: string }) {
  return (
    <View style={[styles.wordmarkRow, { marginTop: 14 * s }]}>
      <Text style={[styles.wordmark, { color: pal.accent, fontSize: 10 * s, letterSpacing: 0.8 * s }]} numberOfLines={1}>
        Prabhat Samgiita
      </Text>
      {numberText ? <Text style={[styles.wordmarkNum, { color: pal.sub, fontSize: 10 * s }]}>{numberText}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", backgroundColor: "#20281A" },
  inner: { flex: 1 },
  coverWrap: { alignSelf: "center", overflow: "hidden" },
  titleBlock: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 10 },
  title: { fontFamily: amFonts.display, textTransform: "uppercase", textAlign: "center" },
  performer: { fontFamily: amFonts.semi, textAlign: "center" },
  left: { textAlign: "left" },
  words: { flex: 1, justifyContent: "center" },
  wordsRoman: { fontFamily: amFonts.bold },
  wordsDeva: { fontFamily: amFonts.devanagariSemi },
  byRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  miniCover: { overflow: "hidden" },
  byText: { flex: 1, minWidth: 0 },
  byTitle: { fontFamily: amFonts.bold },
  wordmarkRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wordmark: { fontFamily: amFonts.bold, textTransform: "uppercase", flexShrink: 1 },
  wordmarkNum: { fontFamily: amFonts.bold },
})
