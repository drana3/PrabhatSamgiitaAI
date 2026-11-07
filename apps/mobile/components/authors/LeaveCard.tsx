import { StyleSheet, Text, View } from "react-native"

import { PillButton, SIDE } from "@/components/authors/AuthorsUi"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"

/** "Leave without saving?": shown when Back is pressed on a form with unsaved changes. Nothing is lost until Leave. */
export function LeaveCard({ theme, onStay, onLeave }: { theme: SongsTheme; onStay: () => void; onLeave: () => void }) {
  const t = useT()
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.dangerText }]} accessibilityRole="alert">
      <Text style={[styles.title, { color: theme.textHeading }]}>{t("authors.leave.title")}</Text>
      <Text style={[styles.body, { color: theme.textBody }]}>{t("authors.leave.body")}</Text>
      <View style={styles.row}>
        <PillButton theme={theme} flex label={t("authors.leave.stay")} onPress={onStay} />
        <PillButton theme={theme} flex tone="danger" label={t("authors.leave.go")} onPress={onLeave} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { marginHorizontal: SIDE, marginTop: 8, borderRadius: 20, borderWidth: 1, padding: 16, gap: 10 },
  title: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
  row: { flexDirection: "row", gap: 8 },
})
