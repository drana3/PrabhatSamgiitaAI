import { useEffect, useRef, useState, type RefObject } from "react"
import { StyleSheet, Text, View } from "react-native"
import Svg, { Circle, Path } from "react-native-svg"

import { HintBubble } from "@/components/common/HintBubble"
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

/** The bubble shows once per run of the app, not on every player opening; the gold dot stays until the sheet is opened. */
let bubbleShownThisRun = false

/**
 * "About this song": the "i" in the row of icons under the transport (Save, Download, Queue, Share, i). Until the
 * person opens it once, it wears a small gold dot, and a bubble says what it is for a few seconds. The bubble is
 * components/common/HintBubble.tsx: it sits on free ground next to the icon (`avoid` names the rows of buttons it must
 * not cover), takes no touches, and a tap anywhere or the time running out takes it away. Opening the sheet ends the
 * hint for good (stores/pageHintsStore.ts).
 */
export function AboutButton({ onOpen, avoid }: { onOpen: () => void; avoid?: readonly RefObject<View | null>[] }) {
  const t = useT()
  const ready = useHintsReady()
  const seen = usePageHintsStore((s) => s.aboutHintSeen)
  const markSeen = usePageHintsStore((s) => s.markAboutHintSeen)
  const hint = ready && !seen
  const wrap = useRef<View>(null)
  const [bubbleOpen, setBubbleOpen] = useState(!bubbleShownThisRun)
  useEffect(() => {
    if (hint && bubbleOpen) bubbleShownThisRun = true
  }, [hint, bubbleOpen])
  return (
    <View ref={wrap} collapsable={false} style={styles.wrap}>
      <HintBubble text={t("player.about.hint")} active={hint && bubbleOpen} anchorRef={wrap} avoid={avoid} onDismiss={() => setBubbleOpen(false)} />
      <TouchButton
        accessibilityRole="button"
        accessibilityLabel={t("player.about.button")}
        accessibilityHint={hint ? t("player.about.hint") : undefined}
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
  songTitle: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 24, letterSpacing: -0.48, textTransform: "uppercase", paddingHorizontal: 20, paddingBottom: 12, color: amColors.white },
  section: { paddingHorizontal: 20, paddingBottom: 16, gap: 6 },
  sectionHead: { fontFamily: amFonts.bold, fontSize: 12, letterSpacing: 0.96, textTransform: "uppercase", color: amColors.gold300 },
  body: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 24, color: queueColors.sub },
  cta: { paddingHorizontal: 20, paddingTop: 4 },
})
