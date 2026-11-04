import { StyleSheet, Text, View } from "react-native"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { orangeWash, SheetPill } from "@/components/player-v2/Rows"
import { Sheet } from "@/components/player-v2/Sheet"
import { PressScale } from "@/components/today/motion"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amRadius } from "@/constants/tokens/amSpacing"
import { amFonts } from "@/constants/tokens/amTypography"
import { formatClock } from "@/lib/playerV2/transportState"
import { versionRowMeta, type PlayerVersion } from "@/lib/playerV2/versions"

type Props = {
  visible: boolean
  theme: AmTheme
  versions: PlayerVersion[]
  selectedIndex: number
  /** Label and action of the single Download pill at the bottom (selected version). */
  download: { label: string; disabled: boolean; onPress: () => void; done?: boolean } | null
  onSelect: (index: number) => void
  onClose: () => void
}

/**
 * Versions sheet (prototype RECORDINGS). One row per version: performer in bold,
 * then `Instrument · length · tag`, a check on the selected row. Tapping a row plays
 * that version and closes the sheet. Download sits once at the bottom.
 */
export function VersionsSheet({ visible, theme, versions, selectedIndex, download, onSelect, onClose }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Versions" theme={theme}>
      <View style={styles.list}>
        {versions.map((version, index) => {
          const on = index === selectedIndex
          return (
            <PressScale
              key={version.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${version.performer}, ${versionRowMeta(version, formatClock)}`}
              onPress={() => {
                onSelect(index)
                onClose()
              }}
              pressedScale={0.98}
              style={[styles.row, on && { backgroundColor: orangeWash(theme) }]}
            >
              <View style={styles.name}>
                <Text style={[styles.who, { color: theme.textHeading }]} numberOfLines={1}>
                  {version.performer}
                </Text>
                <Text style={[styles.meta, { color: theme.textBody }]} numberOfLines={1}>
                  {versionRowMeta(version, formatClock)}
                </Text>
              </View>
              {on ? <PlayerIcon name="check" size={22} color={amColors.orange500} /> : <View style={styles.noCheck} />}
            </PressScale>
          )
        })}
      </View>
      {download ? (
        <View style={styles.pad}>
          <SheetPill
            theme={theme}
            label={download.label}
            tone={download.done ? "sand" : "brand"}
            disabled={download.disabled}
            onPress={download.onPress}
          />
        </View>
      ) : null}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 10, paddingBottom: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: amRadius.card,
  },
  name: { flex: 1, minWidth: 0, gap: 2 },
  who: { fontFamily: amFonts.semi, fontSize: 18, lineHeight: 22 },
  meta: { fontFamily: amFonts.medium, fontSize: 14 },
  noCheck: { width: 22, height: 22 },
  pad: { paddingHorizontal: 20, paddingBottom: 24 },
})
