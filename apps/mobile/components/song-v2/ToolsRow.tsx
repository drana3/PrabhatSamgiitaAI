import { StyleSheet, View } from "react-native"
import { ChevronDown } from "lucide-react-native"

import { Pill } from "@/components/song-v2/common"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amSpace } from "@/constants/tokens/amSpacing"

/**
 * Tools row under the tab strip: a `Roman · EN` pill that opens the script and
 * translation sheet, and a Chords toggle (only for songs with reviewed chords).
 */
export function ToolsRow({
  theme,
  scriptLabel,
  translationPill,
  chordsAvailable,
  chordsOn,
  onOpenSheet,
  onToggleChords,
}: {
  theme: AmTheme
  scriptLabel: string
  translationPill: string
  chordsAvailable: boolean
  chordsOn: boolean
  onOpenSheet: () => void
  onToggleChords: () => void
}) {
  return (
    <View style={styles.row}>
      <Pill
        theme={theme}
        label={`${scriptLabel} · ${translationPill}`}
        accessibilityLabel={`Script ${scriptLabel}, translations ${translationPill}. Change`}
        onPress={onOpenSheet}
        trailing={<ChevronDown size={18} color={theme.textBody} />}
      />
      {chordsAvailable ? (
        <Pill
          theme={theme}
          label="Chords"
          selected={chordsOn}
          tone={chordsOn ? "brand" : "card"}
          accessibilityLabel={chordsOn ? "Chords on. Turn off" : "Chords off. Turn on"}
          onPress={onToggleChords}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: amSpace.s2, flexWrap: "wrap" },
})
