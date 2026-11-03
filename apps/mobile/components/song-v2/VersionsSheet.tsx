import { ScrollView, StyleSheet, Text, View } from "react-native"
import { Check } from "lucide-react-native"

import { BottomSheet } from "@/components/song-v2/BottomSheet"
import { Pill } from "@/components/song-v2/common"
import { PressScale } from "@/components/today/motion"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amGap, amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amFontSize, amType } from "@/constants/tokens/amTypography"
import { downloadLabel, versionDetail, type DownloadPhase, type SongVersion } from "@/lib/songPage/versions"

/**
 * Versions sheet (SCR-18): plain rows, performer in bold, `Instrument · length
 * · tag` under it, a check on the selected row. Tapping a row plays that
 * version and closes the sheet. One Download pill at the bottom downloads the
 * selected version.
 */
export function VersionsSheet({
  theme,
  visible,
  versions,
  selectedUrl,
  onClose,
  onPick,
  phase,
  progress,
  showDownload,
  onDownload,
}: {
  theme: AmTheme
  visible: boolean
  versions: SongVersion[]
  selectedUrl: string | null
  onClose: () => void
  onPick: (version: SongVersion) => void
  phase: DownloadPhase
  progress: number
  showDownload: boolean
  onDownload: () => void
}) {
  return (
    <BottomSheet theme={theme} visible={visible} onClose={onClose} title="Versions" heightRatio={0.6}>
      <ScrollView contentContainerStyle={styles.list}>
        {versions.length === 0 ? (
          <Text style={[amType.body, { color: theme.textBody }]}>This song has no recording in the app yet.</Text>
        ) : (
          versions.map((version) => {
            const selected = version.url === selectedUrl
            return (
              <PressScale
                key={version.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${version.performer}. ${versionDetail(version)}${selected ? ". Selected" : ""}`}
                onPress={() => onPick(version)}
                pressedScale={0.985}
                style={[styles.row, { backgroundColor: theme.card, borderColor: selected ? theme.brand : theme.line }]}
              >
                <View style={styles.text}>
                  <Text style={[styles.name, { color: theme.textHeading }]} numberOfLines={2}>
                    {version.performer}
                  </Text>
                  <Text style={[amType.body, { color: theme.textBody }]} numberOfLines={1}>
                    {versionDetail(version)}
                  </Text>
                </View>
                {selected ? <Check size={22} color={theme.brand} /> : null}
              </PressScale>
            )
          })
        )}
      </ScrollView>
      {showDownload && versions.length ? (
        <View style={styles.footer}>
          <Pill
            theme={theme}
            tone={phase === "saved" ? "brand" : "ink"}
            label={downloadLabel(phase, progress)}
            onPress={onDownload}
            disabled={phase === "downloading"}
            accessibilityLabel={phase === "saved" ? "Downloaded. Remove the download" : downloadLabel(phase, progress)}
          />
        </View>
      ) : null}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: amGap.gutter, paddingBottom: amSpace.s4, gap: amSpace.s2 },
  row: {
    minHeight: amTouchTarget + amSpace.s4,
    borderRadius: amRadius.card,
    borderWidth: 1,
    paddingHorizontal: amSpace.s4,
    paddingVertical: amSpace.s3,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s3,
  },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: amFonts.bold, fontSize: amFontSize.body },
  footer: { paddingHorizontal: amGap.gutter, paddingBottom: amSpace.s4 },
})
