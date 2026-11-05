import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { BlurView } from "expo-blur"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { TouchButton } from "@/components/player-v2/TouchButton"
import { playerColors, playerSize } from "@/components/player-v2/playerTokens"
import { amColors } from "@/constants/tokens/amColors"
import { amRadius } from "@/constants/tokens/amSpacing"
import { amFonts } from "@/constants/tokens/amTypography"
import type { PlayButtonState } from "@/lib/playerV2/transportState"
import { useT } from "@/lib/i18n"

type Props = {
  playState: PlayButtonState
  canNext: boolean
  onPlayPause: () => void
  onPrevious: () => void
  onNext: () => void
  onExit: () => void
}

/**
 * Drive mode (prototype .drive-ctrls, .drive-play): large on purpose, so the driver
 * can hit a control without looking. Previous and next are 72px pills side by side,
 * play/pause is a full-width 96px pill under them, and one pill leaves the mode.
 */
export function DriveControls({ playState, canNext, onPlayPause, onPrevious, onNext, onExit }: Props) {
  const t = useT()
  return (
    <View>
      <View style={styles.pair}>
        <TouchButton
          accessibilityRole="button"
          accessibilityLabel={t("player.prev")}
          onAction={onPrevious}
          containerStyle={styles.skipHit}
          style={styles.skip}
        >
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          <PlayerIcon name="prev" size={playerSize.driveGlyph} color={amColors.white} />
        </TouchButton>
        <TouchButton
          accessibilityRole="button"
          accessibilityLabel={t("player.next")}
          accessibilityState={{ disabled: !canNext }}
          onAction={canNext ? onNext : undefined}
          containerStyle={styles.skipHit}
          style={[styles.skip, !canNext && styles.disabled]}
        >
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          <PlayerIcon name="next" size={playerSize.driveGlyph} color={amColors.white} />
        </TouchButton>
      </View>

      <TouchButton
        accessibilityRole="button"
        accessibilityLabel={playState === "pause" ? t("player.pause") : playState === "spinner" ? t("player.loading") : t("player.play")}
        onAction={onPlayPause}
        pressedScale={0.985}
        containerStyle={styles.playHit}
        style={styles.play}
      >
        {playState === "spinner" ? (
          <ActivityIndicator size="large" color={playerColors.onBrand} />
        ) : (
          <PlayerIcon name={playState === "pause" ? "pause" : "play"} size={playerSize.drivePlayGlyph} color={playerColors.onBrand} />
        )}
      </TouchButton>

      <TouchButton
        accessibilityRole="button"
        accessibilityLabel={t("player.drive.exit.a11y")}
        onAction={onExit}
        containerStyle={styles.exitHit}
        style={styles.exit}
      >
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        <PlayerIcon name="drive" size={18} color={playerColors.gold} />
        <Text style={styles.exitText}>{t("player.drive.exit")}</Text>
      </TouchButton>
    </View>
  )
}

const styles = StyleSheet.create({
  pair: { flexDirection: "row", gap: 10, marginHorizontal: 10 },
  skipHit: { flex: 1 },
  skip: {
    height: playerSize.driveSkipHeight,
    borderRadius: amRadius.pill,
    backgroundColor: playerColors.glassDark,
    borderWidth: 1,
    borderColor: playerColors.glassEdge,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  disabled: { opacity: 0.35 },
  playHit: { marginTop: 10, marginHorizontal: 10 },
  play: {
    height: playerSize.drivePlayHeight,
    borderRadius: amRadius.pill,
    backgroundColor: playerColors.action,
    alignItems: "center",
    justifyContent: "center",
  },
  exitHit: { marginTop: 10, marginHorizontal: 10 },
  exit: {
    height: 48,
    flexDirection: "row",
    gap: 6,
    borderRadius: amRadius.pill,
    backgroundColor: playerColors.glassDark,
    borderWidth: 1,
    borderColor: playerColors.gold,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  exitText: { fontFamily: amFonts.semi, fontSize: 13, color: playerColors.gold },
})
