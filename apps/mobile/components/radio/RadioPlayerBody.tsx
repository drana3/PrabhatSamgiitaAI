import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { Trophy } from "lucide-react-native"

import { DriveControls } from "@/components/player-v2/DriveControls"
import { ThickScrubber } from "@/components/player-v2/Scrubber"
import { TouchButton } from "@/components/player-v2/TouchButton"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { playerColors } from "@/components/player-v2/playerTokens"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import type { PlayButtonState } from "@/lib/playerV2/transportState"
import { href } from "@/utils/href"

type Props = {
  /** "All categories", "Kiirtan" ... what the Radio plays now */
  channel: string
  title: string
  /** "Priya Devi · Kiirtan" */
  subtitle: string
  position: number
  duration: number | null
  onSeek: (seconds: number) => void
  playState: PlayButtonState
  canNext: boolean
  onPlayPause: () => void
  onPrevious: () => void
  onNext: () => void
  onMix: () => void
  /** a sleep timer chip (or anything small) shown under the seek bar; null when no timer runs */
  extra?: ReactNode
  /** empty room above the text, so the text starts under the picture (0 on a short screen) */
  topGap?: number
}

/**
 * The dark block of the Radio player (variant D): "NOW PLAYING · channel", the title, who plays it, the link "Mix several
 * categories", the seek bar, the big skip and play pills, and the link to what is played the most.
 */
export function RadioPlayerBody(props: Props) {
  const t = useT()
  const router = useRouter()
  return (
    <View style={styles.body}>
      <View style={[styles.text, { paddingTop: 16 + (props.topGap ?? 0) }]}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {t("radio.player.nowPlaying", { channel: props.channel })}
        </Text>
        <Text style={styles.title} numberOfLines={3} accessibilityRole="header">
          {props.title}
        </Text>
        {props.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {props.subtitle}
          </Text>
        ) : null}
        <TouchButton
          accessibilityRole="button"
          accessibilityLabel={t("radio.player.mix")}
          onAction={props.onMix}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 16 }}
          containerStyle={styles.mixHit}
          style={styles.mix}
        >
          <Text style={styles.mixText}>{t("radio.player.mix")}</Text>
          <View style={styles.chevron}>
            <PlayerIcon name="chevronSmall" size={16} color={playerColors.gold} />
          </View>
        </TouchButton>
      </View>

      <View style={styles.lower}>
        <ThickScrubber position={props.position} duration={props.duration} onSeek={props.onSeek} />
        {props.extra}
        <View style={styles.controls}>
          <DriveControls
            compact
            playState={props.playState}
            canNext={props.canNext}
            onPlayPause={props.onPlayPause}
            onPrevious={props.onPrevious}
            onNext={props.onNext}
          />
        </View>
        <TouchButton
          accessibilityRole="link"
          accessibilityLabel={t("top.radio.link")}
          onAction={() => router.push(href("/top-played"))}
          containerStyle={styles.topHit}
          style={styles.top}
        >
          <Trophy size={18} color={playerColors.gold} strokeWidth={1.9} />
          <Text style={styles.topText} numberOfLines={1}>
            {t("top.radio.link")}
          </Text>
        </TouchButton>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1, minHeight: 0, justifyContent: "space-between" },
  text: { paddingHorizontal: 20, gap: 8 },
  chevron: { transform: [{ rotate: "-90deg" }] },
  eyebrow: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 1.6, textTransform: "uppercase", color: playerColors.gold },
  title: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 32, letterSpacing: -0.6, textTransform: "uppercase", color: playerColors.text },
  subtitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21, color: playerColors.textSoft },
  mixHit: { alignSelf: "flex-start", marginTop: 4 },
  mix: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 6, borderBottomWidth: 1, borderBottomColor: playerColors.gold },
  mixText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20, color: playerColors.gold },
  lower: { gap: 12 },
  controls: { marginTop: 4 },
  topHit: { alignSelf: "center" },
  top: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  topText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20, color: playerColors.text },
})
