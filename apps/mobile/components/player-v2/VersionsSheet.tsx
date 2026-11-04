import { StyleSheet, Text, View } from "react-native"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { orangeWash, SheetPill } from "@/components/player-v2/Rows"
import { Sheet } from "@/components/player-v2/Sheet"
import { TouchButton } from "@/components/player-v2/TouchButton"
import { PressScale } from "@/components/today/motion"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amRadius } from "@/constants/tokens/amSpacing"
import { amFonts } from "@/constants/tokens/amTypography"
import { PLAY_SCOPE_OPTIONS, type PlayMode } from "@/lib/playerV2/versionMode"
import { formatClock } from "@/lib/playerV2/transportState"
import { versionRowMeta, type PlayerVersion } from "@/lib/playerV2/versions"

type Props = {
  visible: boolean
  theme: AmTheme
  versions: PlayerVersion[]
  selectedIndex: number
  /** Label and action of the single Download pill at the bottom (selected version). */
  download: { label: string; disabled: boolean; onPress: () => void; done?: boolean; tone?: "brand" | "sand" | "ink" } | null
  onSelect: (index: number) => void
  /** "Play only this version" or "Play all versions"; the toggle is drawn when there is more than one version. */
  playMode: PlayMode
  onPlayMode: (mode: PlayMode) => void
  onClose: () => void
}

/**
 * Versions sheet (prototype RECORDINGS). One row per version: performer in bold,
 * then `Instrument · length · tag`, a check on the selected row. Tapping a row plays
 * that version and closes the sheet. Download sits once at the bottom.
 */
export function VersionsSheet({ visible, theme, versions, selectedIndex, download, onSelect, playMode, onPlayMode, onClose }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Versions" theme={theme}>
      {versions.length > 1 ? (
        <View style={[styles.scope, { backgroundColor: theme.inner, borderColor: theme.line }]} accessibilityRole="radiogroup">
          {PLAY_SCOPE_OPTIONS.map((option) => {
            const on = option.mode === playMode
            return (
              <TouchButton
                key={option.mode}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={option.label}
                onAction={() => onPlayMode(option.mode)}
                pressedScale={0.97}
                containerStyle={styles.scopeCell}
                style={[styles.scopeSeg, on && { backgroundColor: amColors.orange500 }]}
              >
                <Text style={[styles.scopeText, { color: on ? amColors.white : theme.textHeading }]} numberOfLines={1}>
                  {option.label}
                </Text>
              </TouchButton>
            )
          })}
        </View>
      ) : null}
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
                <Text style={[styles.who, { color: theme.textBody }]} numberOfLines={1}>
                  {version.performer}
                </Text>
                <Text style={[styles.meta, { color: theme.textBody }]} numberOfLines={1}>
                  {versionRowMeta({ ...version, tag: version.tag === "Best" || version.tag === "Community" ? version.tag : null }, formatClock)}
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
            tone={download.tone ?? (download.done ? "sand" : "brand")}
            disabled={download.disabled}
            onPress={download.onPress}
          />
        </View>
      ) : null}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  scope: { flexDirection: "row", marginHorizontal: 20, marginBottom: 12, padding: 3, borderRadius: amRadius.pill, borderWidth: 1, gap: 3 },
  scopeCell: { flex: 1 },
  scopeSeg: { height: 40, borderRadius: amRadius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  scopeText: { fontFamily: amFonts.semi, fontSize: 13 },
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
  // The prototype's `.vrow .vn span` rule also reaches the performer name, so the board draws it as
  // 14px medium in the body colour. The board is the spec.
  who: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 22, marginTop: 1 },
  meta: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20.3 },
  noCheck: { width: 22, height: 22 },
  pad: { paddingHorizontal: 20, paddingBottom: 24 },
})
