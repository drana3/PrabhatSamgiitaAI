import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { RotateCcw } from "lucide-react-native"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { TouchButton } from "@/components/player-v2/TouchButton"
import { playerColors, playerSize } from "@/components/player-v2/playerTokens"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import type { RepeatMode } from "@/lib/playerV2/controller"
import type { PlayButtonState } from "@/lib/playerV2/transportState"
import { t, useT } from "@/lib/i18n"

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
  get off() { return t("player.repeat.off") },
  get all() { return t("player.repeat.allList") },
  get one() { return t("player.repeat.thisSong") },
}

export function PlayGlyph({ state, size }: { state: PlayButtonState; size: number }) {
  if (state === "spinner") return <ActivityIndicator color={playerColors.onBrand} />
  if (state === "error") return <RotateCcw size={size} color={playerColors.onBrand} />
  return <PlayerIcon name={state === "pause" ? "pause" : "play"} size={size} color={playerColors.onBrand} />
}

export const playButtonLabel: Record<PlayButtonState, string> = {
  get play() { return t("player.play") },
  get pause() { return t("player.pause") },
  get spinner() { return t("player.loading") },
  get error() { return t("player.tryAgain") },
}

/**
 * Shuffle, previous, play/pause, next, repeat (prototype .ctrls). Every button
 * answers on touch-down. The play button shows a spinner while the track loads or
 * buffers, never a pause icon. Repeat one song carries a small gold "1".
 */
export function TransportRow(props: Props) {
  const t = useT()
  const { playState, shuffleOn, repeatMode, canNext } = props
  return (
    <View style={styles.row}>
      <TouchButton
        accessibilityRole="button"
        accessibilityLabel={shuffleOn ? t("player.shuffle.on") : t("player.shuffle.off")}
        accessibilityState={{ selected: shuffleOn }}
        onAction={props.onShuffle}
        style={styles.small}
      >
        <PlayerIcon name="shuffle" size={playerSize.smallGlyph} color={shuffleOn ? playerColors.gold : playerColors.textSoft} />
      </TouchButton>

      <TouchButton accessibilityRole="button" accessibilityLabel={t("player.prev")} onAction={props.onPrevious} style={styles.skip}>
        <PlayerIcon name="prev" size={playerSize.smallGlyph} color={amColors.white} />
      </TouchButton>

      <TouchButton
        accessibilityRole="button"
        accessibilityLabel={playButtonLabel[playState]}
        accessibilityState={{ busy: playState === "spinner" }}
        onAction={props.onPlayPause}
        pressedScale={0.95}
        style={styles.disc}
      >
        <PlayGlyph state={playState} size={playerSize.playGlyph} />
      </TouchButton>

      <TouchButton
        accessibilityRole="button"
        accessibilityLabel={t("player.next")}
        accessibilityState={{ disabled: !canNext }}
        onAction={canNext ? props.onNext : undefined}
        style={[styles.skip, !canNext && styles.disabled]}
      >
        <PlayerIcon name="next" size={playerSize.smallGlyph} color={amColors.white} />
      </TouchButton>

      <TouchButton
        accessibilityRole="button"
        accessibilityLabel={REPEAT_NAME[repeatMode]}
        accessibilityState={{ selected: repeatMode !== "off" }}
        onAction={props.onRepeat}
        style={styles.small}
      >
        <PlayerIcon name="repeat" size={playerSize.smallGlyph} color={repeatMode === "off" ? playerColors.textSoft : playerColors.gold} />
        {repeatMode === "one" ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>1</Text>
          </View>
        ) : null}
      </TouchButton>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginHorizontal: 20,
  },
  small: { width: playerSize.small.w, height: playerSize.small.h, alignItems: "center", justifyContent: "center", borderRadius: 9999 },
  skip: {
    width: playerSize.skip,
    height: playerSize.skip,
    borderRadius: 9999,
    backgroundColor: playerColors.glassDark,
    borderWidth: 1,
    borderColor: playerColors.glassEdge,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  disc: {
    width: playerSize.playDisc,
    height: playerSize.playDisc,
    borderRadius: playerSize.playDisc / 2,
    backgroundColor: playerColors.action,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.35 },
  badge: {
    position: "absolute",
    right: 5,
    top: 9,
    width: 15,
    height: 15,
    borderRadius: 9999,
    backgroundColor: playerColors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: amFonts.display, fontSize: 10, lineHeight: 15, color: amColors.sage900, textAlign: "center" },
})
