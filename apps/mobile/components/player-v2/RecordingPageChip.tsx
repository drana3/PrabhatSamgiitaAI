import { StyleSheet, Text } from "react-native"

import { TouchButton } from "@/components/player-v2/TouchButton"
import { playerColors } from "@/components/player-v2/playerTokens"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"

type Props = {
  /** opens the Kiirtan page of the playing recording */
  onOpen: () => void
}

/**
 * A small chip under the title of a Kiirtan in the player: "Chords · Video · Notes ›".
 * It tells a listener that the recording has a page with more, and opens it (docs/kiirtan-page.md).
 */
export function RecordingPageChip({ onOpen }: Props) {
  const t = useT()
  return (
    <TouchButton
      accessibilityRole="button"
      accessibilityLabel={t("kPage.chip.a11y")}
      testID="recording-page-chip"
      onAction={onOpen}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      containerStyle={styles.hit}
      style={styles.chip}
    >
      <Text style={styles.text} numberOfLines={1}>
        {t("kPage.chip.label")}
      </Text>
      <Text style={styles.arrow} accessibilityElementsHidden importantForAccessibility="no">
        ›
      </Text>
    </TouchButton>
  )
}

const styles = StyleSheet.create({
  hit: { alignSelf: "center", marginTop: 8 },
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
  arrow: { fontFamily: amFonts.bold, fontSize: 18, lineHeight: 20, color: playerColors.gold },
})
