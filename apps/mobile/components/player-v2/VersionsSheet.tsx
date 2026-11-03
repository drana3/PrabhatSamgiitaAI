import { FlatList, StyleSheet, View } from "react-native"

import { ChoiceRow, PillButton } from "@/components/player-v2/Rows"
import { Sheet } from "@/components/player-v2/Sheet"
import { amSpace } from "@/constants/tokens/amSpacing"
import type { AmTheme } from "@/constants/tokens/amColors"
import { formatClock } from "@/lib/playerV2/transportState"
import { versionRowMeta, type PlayerVersion } from "@/lib/playerV2/versions"

type Props = {
  visible: boolean
  theme: AmTheme
  versions: PlayerVersion[]
  selectedIndex: number
  /** Label and action of the single Download pill at the bottom (selected version). */
  download: { label: string; disabled: boolean; onPress: () => void } | null
  onSelect: (index: number) => void
  onClose: () => void
}

/**
 * Versions sheet (SCR-18). One row per version: performer in bold, then
 * `Instrument · length · tag`, a check on the selected row. Tapping a row plays
 * that version and closes the sheet. Download sits once at the bottom.
 */
export function VersionsSheet({ visible, theme, versions, selectedIndex, download, onSelect, onClose }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title={`${versions.length} ${versions.length === 1 ? "version" : "versions"}`} theme={theme} heightShare={0.62}>
      <FlatList
        data={versions}
        keyExtractor={(v) => v.id}
        renderItem={({ item, index }) => (
          <ChoiceRow
            theme={theme}
            title={item.performer}
            meta={versionRowMeta(item, formatClock)}
            selected={index === selectedIndex}
            onPress={() => {
              onSelect(index)
              onClose()
            }}
          />
        )}
      />
      {download ? (
        <View style={styles.footer}>
          <PillButton theme={theme} label={download.label} disabled={download.disabled} onPress={download.onPress} />
        </View>
      ) : null}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  footer: { paddingTop: amSpace.s3 },
})
