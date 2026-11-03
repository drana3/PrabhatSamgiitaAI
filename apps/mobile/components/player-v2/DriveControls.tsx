import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { Pause, Play, SkipBack, SkipForward } from "lucide-react-native"

import { TouchButton } from "@/components/player-v2/TouchButton"
import { amRadius, amSpace } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { playerColors, playerSize } from "@/components/player-v2/playerTokens"
import type { PlayButtonState } from "@/lib/playerV2/transportState"

type Props = {
  playState: PlayButtonState
  canNext: boolean
  onPlayPause: () => void
  onPrevious: () => void
  onNext: () => void
  onExit: () => void
}

/**
 * Drive mode (spec SCR-12 item 10): large on purpose, so the driver can hit
 * a control without looking. Play/pause is a full-width 96px pill, previous
 * and next are 72px pills.
 */
export function DriveControls({ playState, canNext, onPlayPause, onPrevious, onNext, onExit }: Props) {
  return (
    <View style={styles.wrap}>
      <TouchButton
        accessibilityRole="button"
        accessibilityLabel={playState === "pause" ? "Pause" : playState === "spinner" ? "Loading" : "Play"}
        onAction={onPlayPause}
        pressedScale={0.97}
        style={styles.play}
      >
        {playState === "spinner" ? (
          <ActivityIndicator size="large" color={playerColors.onBrand} />
        ) : playState === "pause" ? (
          <Pause size={playerSize.driveGlyph} color={playerColors.onBrand} fill={playerColors.onBrand} />
        ) : (
          <Play size={playerSize.driveGlyph} color={playerColors.onBrand} fill={playerColors.onBrand} />
        )}
      </TouchButton>
      <View style={styles.pair}>
        <TouchButton accessibilityRole="button" accessibilityLabel="Previous song" onAction={onPrevious} containerStyle={styles.skipHit} style={styles.skip}>
          <SkipBack size={playerSize.driveGlyph} color={playerColors.text} fill={playerColors.text} />
        </TouchButton>
        <TouchButton
          accessibilityRole="button"
          accessibilityLabel="Next song"
          accessibilityState={{ disabled: !canNext }}
          onAction={canNext ? onNext : undefined}
          containerStyle={styles.skipHit}
          style={[styles.skip, !canNext && styles.disabled]}
        >
          <SkipForward size={playerSize.driveGlyph} color={playerColors.text} fill={playerColors.text} />
        </TouchButton>
      </View>
      <TouchButton accessibilityRole="button" accessibilityLabel="Leave Drive mode" onAction={onExit} style={styles.exit}>
        <Text style={styles.exitText}>Leave Drive mode</Text>
      </TouchButton>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: amSpace.s3 },
  play: {
    height: playerSize.drivePlayHeight,
    borderRadius: amRadius.pill,
    backgroundColor: playerColors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  pair: { flexDirection: "row", gap: amSpace.s3 },
  skipHit: { flex: 1 },
  skip: {
    height: playerSize.driveSkipHeight,
    borderRadius: amRadius.pill,
    backgroundColor: playerColors.glass,
    borderWidth: 1,
    borderColor: playerColors.glassEdge,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.35 },
  exit: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  exitText: { ...amType.label, fontFamily: amFonts.semi, color: playerColors.gold },
})
