import { useState } from "react"
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"

import { CrossfadeGradient } from "@/components/player-v2/CrossfadeGradient"
import { PlayerIcon, type PlayerIconName } from "@/components/player-v2/PlayerIcons"
import { coverFor } from "@/components/player-v2/playerCovers"
import { Sheet } from "@/components/player-v2/Sheet"
import { TouchButton } from "@/components/player-v2/TouchButton"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { isDarkTheme } from "@/lib/navV2"
import { tintForSong } from "@/lib/playerV2/coverTint"
import {
  SHARE_BACKGROUNDS,
  SHARE_TARGETS,
  sharePalette,
  type ShareBackground,
  type ShareTargetId,
} from "@/lib/playerV2/playerShare"

type Props = {
  visible: boolean
  theme: AmTheme
  songNumber: number
  title: string
  performer: string
  onShare: (target: ShareTargetId) => void
  onClose: () => void
}

const TARGET_ICON: Record<ShareTargetId, PlayerIconName> = {
  copy: "link",
  whatsapp: "whatsapp",
  instagram: "instagram",
  messages: "messages",
  more: "more",
}

/** Card proportions: 3 wide, 4 high. */
const CARD_W = 232
const CARD_H = (CARD_W * 4) / 3

/**
 * The song as a small poster (cover, title, performer, the Prabhat Samgiita wordmark) that follows the
 * background picked under it. The poster is shown, not rendered to an image: react-native-view-shot is
 * not a dependency of the app, so what leaves the phone is the song link and a message.
 * TODO(api): render the poster to an image and attach it once a capture library is added.
 */
export function ShareCard({ songNumber, title, performer, background, width = CARD_W }: { songNumber: number; title: string; performer: string; background: ShareBackground; width?: number }) {
  const cover = coverFor(songNumber)
  const pal = sharePalette(background, tintForSong(songNumber))
  const height = (width * 4) / 3
  const pad = Math.round(width * 0.06)
  return (
    <View style={[styles.card, { width, height, borderRadius: 24 }]} accessibilityLabel={`Share card: ${title}, ${performer}`}>
      <CrossfadeGradient colors={[pal.from, pal.to]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} duration={260} style={StyleSheet.absoluteFill} />
      <View style={[styles.cardInner, { padding: pad }]}>
        <View style={styles.cardTop}>
          <Text style={[styles.wordmark, { color: pal.accent }]} numberOfLines={1}>
            Prabhat Samgiita
          </Text>
          <Text style={[styles.psNumber, { color: pal.sub }]}>PS {songNumber}</Text>
        </View>
        <View style={styles.coverWrap}>
          <Image source={cover.source} contentFit="cover" contentPosition={cover.position} style={StyleSheet.absoluteFill} />
          <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.18)"]} style={StyleSheet.absoluteFill} />
        </View>
        <Text style={[styles.cardTitle, { color: pal.text }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.cardSub, { color: pal.sub }]} numberOfLines={1}>
          {performer}
        </Text>
      </View>
    </View>
  )
}

export function ShareSheet({ visible, theme, songNumber, title, performer, onShare, onClose }: Props) {
  const { width: windowWidth } = useWindowDimensions()
  const [background, setBackground] = useState<ShareBackground>("forest")
  const tint = tintForSong(songNumber)
  const dark = isDarkTheme(theme)
  const cardWidth = Math.min(CARD_W, Math.max(180, windowWidth - 140))

  return (
    <Sheet visible={visible} onClose={onClose} title="Share" theme={theme}>
      <View style={styles.cardRow}>
        <ShareCard songNumber={songNumber} title={title} performer={performer} background={background} width={cardWidth} />
      </View>

      <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel="Card background">
        {SHARE_BACKGROUNDS.map((b) => {
          const pal = sharePalette(b.id, tint)
          const on = b.id === background
          return (
            <TouchButton
              key={b.id}
              accessibilityRole="radio"
              accessibilityLabel={`${b.label} background`}
              accessibilityState={{ selected: on }}
              onAction={() => setBackground(b.id)}
              style={[styles.swatchHit, on && { borderColor: amColors.orange500 }]}
            >
              <View style={[styles.swatch, { borderColor: dark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.18)" }]}>
                <LinearGradient colors={[pal.from, pal.to]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
              </View>
            </TouchButton>
          )
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targets} style={styles.targetScroll}>
        {SHARE_TARGETS.map((t) => (
          <TouchButton
            key={t.id}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            onAction={() => onShare(t.id)}
            containerStyle={styles.targetHit}
            style={styles.target}
          >
            <View style={[styles.targetDisc, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <PlayerIcon name={TARGET_ICON[t.id]} size={26} color={theme.textHeading} />
            </View>
            <Text style={[styles.targetLabel, { color: theme.textBody }]} numberOfLines={2}>
              {t.label}
            </Text>
          </TouchButton>
        ))}
      </ScrollView>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  cardRow: { alignItems: "center", paddingTop: 4, paddingBottom: 20 },
  card: { overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,0.12)" },
  cardInner: { flex: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  wordmark: { fontFamily: amFonts.bold, fontSize: 10.5, letterSpacing: 0.84, textTransform: "uppercase", flexShrink: 1 },
  psNumber: { fontFamily: amFonts.bold, fontSize: 11, letterSpacing: 0.4 },
  coverWrap: { flex: 1, minHeight: 0, borderRadius: 16, overflow: "hidden", marginBottom: 12 },
  cardTitle: { fontFamily: amFonts.display, fontSize: 19, lineHeight: 20, letterSpacing: -0.38, textTransform: "uppercase" },
  cardSub: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, marginTop: 6 },
  swatches: { flexDirection: "row", justifyContent: "center", gap: 14, paddingBottom: 20 },
  swatchHit: { width: 48, height: 48, borderRadius: 9999, borderWidth: 2.5, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  swatch: { width: 36, height: 36, borderRadius: 9999, overflow: "hidden", borderWidth: 1 },
  targetScroll: { flexGrow: 0 },
  targets: { paddingHorizontal: 16, gap: 4 },
  targetHit: { width: 84 },
  target: { alignItems: "center", gap: 8, paddingVertical: 4 },
  targetDisc: { width: 56, height: 56, borderRadius: 9999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  targetLabel: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 15, textAlign: "center" },
})
