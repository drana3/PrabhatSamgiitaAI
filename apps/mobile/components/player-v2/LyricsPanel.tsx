import { memo, useState } from "react"
import { Platform, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native"
import { Frost } from "@/components/common/Frost"
import { LinearGradient } from "expo-linear-gradient"

import { TouchButton } from "@/components/player-v2/TouchButton"
import { lyricColors, playerColors, playerSize } from "@/components/player-v2/playerTokens"
import { amFonts } from "@/constants/tokens/amTypography"
import type { LyricLine } from "@/lib/playerV2/lyricsSync"
import { useT } from "@/lib/i18n"

type Props = {
  lines: LyricLine[]
  devanagari: boolean
  showTranslation: boolean
  /** Shown instead of lyrics when there are none. */
  emptyText: string
  /** A language the person chose and this song lacks: one plain line at the foot of the card, and an action (Request). */
  notice?: { text: string; action: string; onAction?: () => void } | null
  /** Marks the translation as sample material of the demo preview ("Demo content"). */
  demoTag?: boolean
}

/** Transparent to opaque over the first 8% and the last 12% of the scroll area. */
const FADE_TOP = 0.08
const FADE_BOTTOM = 0.12
/** On the web a mask fades the text exactly; devices use the two gradients below. */
const WEB_MASK = "linear-gradient(rgba(0,0,0,0) 0, #000 8%, #000 88%, rgba(0,0,0,0) 100%)"
const webMaskStyle = (Platform.OS === "web" ? { maskImage: WEB_MASK, WebkitMaskImage: WEB_MASK } : null) as ViewStyle | null

/** The panel's own colour (near-black at 78% over the dark end of the photograph), so the edges melt into it. */
const PANEL_FADE_COLOR = "rgba(22, 21, 19, 1)"

/**
 * The lyrics card of the Player: the lines of the song as plain text, each with its translation under it
 * when the person has one. No highlight by time, no word meanings, no tap to seek: the catalogue has no
 * reliable timing, so the card only shows the text.
 */
export function LyricsPanel({ lines, devanagari, showTranslation, emptyText, notice, demoTag }: Props) {
  const t = useT()
  const [viewport, setViewport] = useState(0)

  return (
    <View style={styles.panel}>
      <Frost intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      {lines.length ? (
        <View
          style={[styles.scrollWrap, webMaskStyle]}
          onLayout={(e) => {
            setViewport(e.nativeEvent.layout.height)
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {lines.map((line, index) => (
              <LyricRow
                key={`${index}-${line.text}`}
                line={line}
                devanagari={devanagari}
                showTranslation={showTranslation}
              />
            ))}
          </ScrollView>
          {webMaskStyle ? null : (
            <>
              <LinearGradient
                pointerEvents="none"
                colors={[PANEL_FADE_COLOR, playerColors.maskClear]}
                style={[styles.fade, { top: 0, height: viewport * FADE_TOP }]}
              />
              <LinearGradient
                pointerEvents="none"
                colors={[playerColors.maskClear, PANEL_FADE_COLOR]}
                style={[styles.fade, { bottom: 0, height: viewport * FADE_BOTTOM }]}
              />
            </>
          )}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      )}
      {demoTag ? (
        <View style={styles.demoRow}>
          <View style={styles.demoTag}>
            <Text style={styles.demoTagText}>{t("player.demo")}</Text>
          </View>
        </View>
      ) : null}
      {notice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText} numberOfLines={3}>
            {notice.text}
          </Text>
          {notice.onAction ? (
            <TouchButton
              accessibilityRole="button"
              accessibilityLabel={notice.action}
              onAction={notice.onAction}
              containerStyle={styles.noticeHit}
              style={styles.noticeAction}
            >
              <Text style={styles.noticeActionText}>{notice.action}</Text>
            </TouchButton>
          ) : (
            <Text style={styles.noticeDone}>{notice.action}</Text>
          )}
        </View>
      ) : null}
    </View>
  )
}

type RowProps = {
  line: LyricLine
  devanagari: boolean
  showTranslation: boolean
}

const LyricRow = memo(function LyricRow({ line, devanagari, showTranslation }: RowProps) {
  const translation = showTranslation ? line.translation : undefined
  return (
    <View>
      <Text style={[styles.line, { fontFamily: devanagari ? amFonts.devanagariSemi : amFonts.bold }]}>{line.text}</Text>
      {translation ? <Text style={styles.translation}>{translation}</Text> : <View style={styles.noTranslation} />}
    </View>
  )
})

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    marginTop: playerSize.panelMarginTop,
    marginHorizontal: 10,
    borderRadius: playerSize.panelRadius,
    borderWidth: 1,
    borderColor: playerColors.panelEdge,
    overflow: "hidden",
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  tint: { backgroundColor: playerColors.panelFill },
  scrollWrap: { flex: 1, minHeight: 0 },
  fade: { position: "absolute", left: 0, right: 0 },
  content: { paddingTop: 8, paddingBottom: 40 },
  line: { fontSize: 23, lineHeight: 30, letterSpacing: -0.23, color: lyricColors.line },
  translation: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingTop: 4.5, paddingBottom: 12.5, color: lyricColors.translation },
  noTranslation: { height: 8 },
  notice: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 8, paddingBottom: 8 },
  noticeText: { flex: 1, fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16, color: playerColors.textSoft },
  demoRow: { flexDirection: "row", paddingTop: 6 },
  demoTag: { borderWidth: 1, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 3, borderColor: playerColors.chipEdge },
  demoTagText: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.4, color: playerColors.textSoft },
  noticeHit: { flexShrink: 0 },
  noticeAction: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: playerColors.chipFill,
    borderWidth: 1,
    borderColor: playerColors.chipEdge,
  },
  noticeActionText: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, color: playerColors.text },
  noticeDone: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, color: playerColors.textSoft },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { fontFamily: amFonts.regular, fontSize: 16, lineHeight: 23, color: playerColors.textSoft, textAlign: "center" },
})
