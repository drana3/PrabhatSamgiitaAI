import { useEffect } from "react"
import { StyleSheet, Text, View } from "react-native"
import Svg, { Circle, Path } from "react-native-svg"
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated"

import { SheetPill } from "@/components/player-v2/Rows"
import { Sheet } from "@/components/player-v2/Sheet"
import { TouchButton } from "@/components/player-v2/TouchButton"
import { playerColors, playerSize, queueColors } from "@/components/player-v2/playerTokens"
import { amColors, amDark } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AboutContent } from "@/lib/playerV2/playerActions"
import { useT } from "@/lib/i18n"
import { useHintsReady, usePageHintsStore } from "@/stores/pageHintsStore"

/** The letter "i" in a ring: the one mark of "About this song". */
function InfoGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Circle cx={12} cy={12} r={9.25} stroke={color} strokeWidth={1.75} />
      <Path d="M12 11v5.2" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Circle cx={12} cy={7.9} r={1.15} fill={color} />
    </Svg>
  )
}

const HINT_DELAY_MS = 900

/**
 * "About this song": the "i" in the row of icons under the transport (Save, Download, Queue, Share, i). Until the
 * person opens it once, it wears a small gold dot and a one-time bubble says what it is; opening the sheet (or tapping
 * the bubble) ends the hint for good (stores/pageHintsStore.ts). Only opacity and transform move, and with Reduce Motion
 * the bubble just appears.
 */
export function AboutButton({ onOpen }: { onOpen: () => void }) {
  const t = useT()
  const reduce = useReducedMotion()
  const ready = useHintsReady()
  const seen = usePageHintsStore((s) => s.aboutHintSeen)
  const markSeen = usePageHintsStore((s) => s.markAboutHintSeen)
  const hint = ready && !seen
  const show = useSharedValue(0)
  useEffect(() => {
    if (!hint) {
      show.value = withTiming(0, { duration: 150 })
      return
    }
    show.value = reduce ? 1 : withDelay(HINT_DELAY_MS, withTiming(1, { duration: 320, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }))
  }, [hint, reduce, show])
  const bubble = useAnimatedStyle(() => ({ opacity: show.value, transform: [{ translateX: (1 - show.value) * 6 }] }))
  return (
    <View style={styles.wrap}>
      {hint ? (
        <Animated.View style={[styles.bubble, bubble]} pointerEvents="box-none">
          <TouchButton accessibilityRole="button" accessibilityLabel={t("player.about.hint")} onAction={markSeen} pressedScale={0.97} style={styles.bubbleBody}>
            <Text style={styles.bubbleText}>{t("player.about.hint")}</Text>
          </TouchButton>
          <View style={styles.tip} />
        </Animated.View>
      ) : null}
      <TouchButton
        accessibilityRole="button"
        accessibilityLabel={t("player.about.button")}
        onAction={() => {
          markSeen()
          onOpen()
        }}
        style={styles.btn}
      >
        <InfoGlyph size={playerSize.utilGlyph} color={playerColors.utilIcon} />
        {hint ? <View style={styles.dot} /> : null}
      </TouchButton>
    </View>
  )
}

type SheetProps = {
  visible: boolean
  songTitle: string
  about: AboutContent | null
  onOpenSong: () => void
  onClose: () => void
  /** false on the song page itself, where "Open song page" would lead nowhere. */
  showOpenSong?: boolean
}

/**
 * The story of the song in full, with a button to its page (words, chords, story). It rises over the cover in the
 * dark look of the queue (Sheet `dark`): black ground, gold small caps, white text, in both themes, because the player
 * is always dark.
 */
export function AboutSheet({ visible, songTitle, about, onOpenSong, onClose, showOpenSong = true }: SheetProps) {
  const t = useT()
  return (
    <Sheet visible={visible} onClose={onClose} title={t("player.about.title")} theme={amDark} dark>
      <Text style={styles.songTitle} accessibilityRole="header">
        {songTitle}
      </Text>
      {about?.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.sectionHead}>{section.heading}</Text>
          <Text style={styles.body}>{section.text}</Text>
        </View>
      ))}
      {showOpenSong ? (
        <View style={styles.cta}>
          <SheetPill theme={amDark} tone="brand" label={t("player.openSong")} onPress={onOpenSong} />
        </View>
      ) : null}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  wrap: { width: playerSize.util, height: playerSize.util, alignItems: "center", justifyContent: "center" },
  btn: { width: playerSize.util, height: playerSize.util, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 9, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: amColors.gold300 },
  // the bubble sits to the left of the button, on the same line, so it never covers the Play and Next buttons above the row
  bubble: { position: "absolute", top: 0, bottom: 0, right: playerSize.util - 4, width: 232, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  bubbleBody: { flexShrink: 1, backgroundColor: amColors.gold300, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, minHeight: 44, justifyContent: "center" },
  bubbleText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 17, color: amDark.page },
  tip: { width: 12, height: 12, marginLeft: -6, backgroundColor: amColors.gold300, transform: [{ rotate: "45deg" }] },
  songTitle: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 24, letterSpacing: -0.48, textTransform: "uppercase", paddingHorizontal: 20, paddingBottom: 12, color: amColors.white },
  section: { paddingHorizontal: 20, paddingBottom: 16, gap: 6 },
  sectionHead: { fontFamily: amFonts.bold, fontSize: 12, letterSpacing: 0.96, textTransform: "uppercase", color: amColors.gold300 },
  body: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 24, color: queueColors.sub },
  cta: { paddingHorizontal: 20, paddingTop: 4 },
})
