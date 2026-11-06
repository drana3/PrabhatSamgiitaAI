import { StyleSheet, Text, View } from "react-native"

import { TouchButton } from "@/components/player-v2/TouchButton"
import { playerColors } from "@/components/player-v2/playerTokens"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { formatClock } from "@/lib/playerV2/transportState"

type Props = {
  /** the second the song was continued from */
  from: number
  onStartOver: () => void
}

/**
 * "Continued from 1:23 · Start over": the song began at the place where it was stopped last time; the
 * button goes back to 0 and forgets that place. Sits under the scrubber while playback is still near it.
 */
export function ResumeNotice({ from, onStartOver }: Props) {
  const t = useT()
  return (
    <View style={styles.row}>
      <Text style={styles.text} numberOfLines={1}>
        {t("player.resume.from", { time: formatClock(from) })}
      </Text>
      <TouchButton
        accessibilityRole="button"
        accessibilityLabel={t("player.resume.startOver")}
        onAction={onStartOver}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        style={styles.button}
      >
        <Text style={styles.buttonText}>{t("player.resume.startOver")}</Text>
      </TouchButton>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 32, paddingHorizontal: 20 },
  text: { ...amType.label, flexShrink: 1, color: playerColors.textSoft },
  button: { minHeight: 32, justifyContent: "center" },
  buttonText: { ...amType.label, fontFamily: amFonts.bold, color: playerColors.gold, textDecorationLine: "underline" },
})
