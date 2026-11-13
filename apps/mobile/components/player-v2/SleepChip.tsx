import { StyleSheet, Text } from "react-native"

import { TouchButton } from "@/components/player-v2/TouchButton"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { playerColors } from "@/components/player-v2/playerTokens"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"

type Props = {
  /** "12:30", "End of song" ... what the timer is waiting for */
  text: string
  onCancel: () => void
}

/** A small chip while a sleep timer runs: "Sleep 12:30". A tap cancels the timer. */
export function SleepChip({ text, onCancel }: Props) {
  const t = useT()
  return (
    <TouchButton
      accessibilityRole="button"
      accessibilityLabel={t("playback.sleep.chip.a11y", { time: text })}
      onAction={onCancel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      containerStyle={styles.hit}
      style={styles.chip}
    >
      <PlayerIcon name="timer" size={16} color={playerColors.gold} />
      <Text style={styles.text} numberOfLines={1}>
        {t("playback.sleep.chip", { time: text })}
      </Text>
      <Text style={styles.cross} accessibilityElementsHidden importantForAccessibility="no">
        ×
      </Text>
    </TouchButton>
  )
}

const styles = StyleSheet.create({
  hit: { alignSelf: "center", marginTop: 4 },
  chip: {
    minHeight: 32,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 9999,
    backgroundColor: playerColors.chipFill,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { ...amType.label, fontFamily: amFonts.bold, color: playerColors.gold },
  cross: { fontFamily: amFonts.bold, fontSize: 18, lineHeight: 20, color: playerColors.gold },
})
