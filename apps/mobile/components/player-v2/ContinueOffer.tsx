import { StyleSheet, Text, View } from "react-native"

import { TouchButton } from "@/components/player-v2/TouchButton"
import { playerColors } from "@/components/player-v2/playerTokens"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { formatClock } from "@/lib/playerV2/transportState"

type Props = {
  /** the saved second */
  at: number
  onContinue: () => void
}

/**
 * "Continue from 12:40": offered under the scrubber when a long recording starts and the listener stopped it
 * somewhere before. A tap goes there; it never jumps by itself. Sits there for the first seconds only.
 */
export function ContinueOffer({ at, onContinue }: Props) {
  const t = useT()
  return (
    <View style={styles.row}>
      <TouchButton
        accessibilityRole="button"
        accessibilityLabel={t("player.continue.from", { time: formatClock(at) })}
        onAction={onContinue}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.button}
      >
        <Text style={styles.text} numberOfLines={1}>
          {t("player.continue.from", { time: formatClock(at) })}
        </Text>
      </TouchButton>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 40, paddingHorizontal: 20 },
  button: {
    minHeight: 36,
    paddingHorizontal: 16,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: playerColors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { ...amType.label, fontFamily: amFonts.bold, color: playerColors.gold },
})
