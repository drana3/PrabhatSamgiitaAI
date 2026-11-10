import { StyleSheet, Text, View } from "react-native"

import { Switch } from "@/components/offline/ListDownloadRow"
import { Press } from "@/components/songs-v2/Press"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"

/**
 * "Only on this phone": the switch inside Saved that keeps just the saved songs that are downloaded. Saved and downloaded are
 * ONE list (Dada, 10 Nov 2026); the download is a state of a saved song (the arrow on its row), not a second list or chip.
 */
export function OnlyOnPhoneRow({ theme, on, onChange }: { theme: SongsTheme; on: boolean; onChange: (on: boolean) => void }) {
  const t = useT()
  return (
    <Press
      accessibilityRole="switch"
      accessibilityLabel={t("songs.saved.downloadedOnly")}
      accessibilityState={{ checked: on }}
      onPress={() => onChange(!on)}
      pressedScale={0.98}
      style={[styles.row, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <View style={styles.text}>
        <Text style={[styles.title, { color: theme.textHeading }]}>{t("songs.saved.downloadedOnly")}</Text>
        <Text style={[styles.hint, { color: theme.textBody }]}>{t("songs.saved.downloadedOnlyHint")}</Text>
      </View>
      <Switch on={on} theme={theme} />
    </Press>
  )
}

const styles = StyleSheet.create({
  row: { minHeight: 64, borderRadius: 20, borderWidth: 1, paddingVertical: 12, paddingLeft: 20, paddingRight: 16, flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 20, marginTop: 12 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
})
