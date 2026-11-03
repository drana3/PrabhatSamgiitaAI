import { ActivityIndicator, StyleSheet, View } from "react-native"
import { Pause, Play, Repeat, Repeat1, RotateCcw, Shuffle, SkipBack, SkipForward } from "lucide-react-native"

import { TouchButton } from "@/components/player-v2/TouchButton"
import { amSpace } from "@/constants/tokens/amSpacing"
import { playerColors, playerSize } from "@/components/player-v2/playerTokens"
import type { RepeatMode } from "@/lib/playerV2/controller"
import type { PlayButtonState } from "@/lib/playerV2/transportState"

type Props = {
  playState: PlayButtonState
  shuffleOn: boolean
  repeatMode: RepeatMode
  canNext: boolean
  onPlayPause: () => void
  onPrevious: () => void
  onNext: () => void
  onShuffle: () => void
  onRepeat: () => void
}

const REPEAT_NAME: Record<RepeatMode, string> = {
  off: "Repeat off",
  all: "Repeat all songs",
  one: "Repeat this song",
}

function PlayGlyph({ state, size }: { state: PlayButtonState; size: number }) {
  if (state === "spinner") return <ActivityIndicator color={playerColors.onBrand} />
  if (state === "pause") return <Pause size={size} color={playerColors.onBrand} fill={playerColors.onBrand} />
  if (state === "error") return <RotateCcw size={size} color={playerColors.onBrand} />
  return <Play size={size} color={playerColors.onBrand} fill={playerColors.onBrand} />
}

export const playButtonLabel: Record<PlayButtonState, string> = {
  play: "Play",
  pause: "Pause",
  spinner: "Loading",
  error: "Try again",
}

/**
 * Shuffle, previous, play/pause, next, repeat (spec SCR-12 item 5). Every
 * button answers on touch-down. The play button shows a spinner while the
 * track loads or buffers, never a pause icon.
 */
export function TransportRow(props: Props) {
  const { playState, shuffleOn, repeatMode, canNext } = props
  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat
  return (
    <View style={styles.row}>
      <TouchButton
        accessibilityRole="button"
        accessibilityLabel={shuffleOn ? "Shuffle on" : "Shuffle off"}
        accessibilityState={{ selected: shuffleOn }}
        onAction={props.onShuffle}
        style={styles.small}
      >
        <Shuffle size={playerSize.smallGlyph} color={shuffleOn ? playerColors.gold : playerColors.textSoft} />
      </TouchButton>

      <TouchButton accessibilityRole="button" accessibilityLabel="Previous song" onAction={props.onPrevious} style={styles.skip}>
        <SkipBack size={playerSize.skipGlyph} color={playerColors.text} fill={playerColors.text} />
      </TouchButton>

      <TouchButton
        accessibilityRole="button"
        accessibilityLabel={playButtonLabel[playState]}
        accessibilityState={{ busy: playState === "spinner" }}
        onAction={props.onPlayPause}
        pressedScale={0.94}
        style={styles.disc}
      >
        <PlayGlyph state={playState} size={playerSize.playGlyph} />
      </TouchButton>

      <TouchButton
        accessibilityRole="button"
        accessibilityLabel="Next song"
        accessibilityState={{ disabled: !canNext }}
        onAction={canNext ? props.onNext : undefined}
        style={[styles.skip, !canNext && styles.disabled]}
      >
        <SkipForward size={playerSize.skipGlyph} color={playerColors.text} fill={playerColors.text} />
      </TouchButton>

      <TouchButton
        accessibilityRole="button"
        accessibilityLabel={REPEAT_NAME[repeatMode]}
        accessibilityState={{ selected: repeatMode !== "off" }}
        onAction={props.onRepeat}
        style={styles.small}
      >
        <RepeatIcon size={playerSize.smallGlyph} color={repeatMode === "off" ? playerColors.textSoft : playerColors.gold} />
      </TouchButton>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: amSpace.s2 },
  small: { width: playerSize.small, height: playerSize.small, alignItems: "center", justifyContent: "center" },
  skip: { width: playerSize.skip, height: playerSize.skip, alignItems: "center", justifyContent: "center" },
  disc: {
    width: playerSize.playDisc,
    height: playerSize.playDisc,
    borderRadius: playerSize.playDisc / 2,
    backgroundColor: playerColors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.35 },
})
