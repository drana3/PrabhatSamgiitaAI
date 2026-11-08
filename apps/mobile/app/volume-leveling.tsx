import { useCallback } from "react"
import { Platform, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { Toggle } from "@/components/notifications/Toggle"
import { DoneButton, Group, SheetNote } from "@/components/profile-v2/SheetBlocks"
import { SheetShell } from "@/components/profile-v2/SheetShell"
import { TodayPress } from "@/components/today/TodayPress"
import { protoFor } from "@/constants/tokens/amToday"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme, useResolvedAppearance } from "@/hooks/useAmTheme"
import { statusBarStyleFor } from "@/lib/appearance"
import { useT } from "@/lib/i18n"
import { capabilitiesFor } from "@/lib/loudness/capabilities"
import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useLoudnessStore } from "@/stores/loudnessStore"
import { href } from "@/utils/href"

/**
 * "Volume leveling" sheet: one switch. On (the default), loud and quiet recordings are moved toward one
 * common level while they play, and the next track in the Radio or a list never jumps out at the listener.
 * The choice is saved at once; Done and the scrim only close it. How it works: docs/loudness-leveling.md.
 */
export default function VolumeLevelingScreen() {
  const router = useRouter()
  const t = useT()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const resolved = useResolvedAppearance()
  const enabled = useLoudnessStore((st) => st.enabled)
  const setEnabled = useLoudnessStore((st) => st.setEnabled)
  const engine = capabilitiesFor({ platform: Platform.OS, mockup: MOCKUP_DATA })

  const onClosed = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(href(NAV_V2_HOME_ROUTE))
  }, [router])

  return (
    <View style={styles.root}>
      <StatusBar style={statusBarStyleFor(resolved)} />
      <SheetShell p={p} label={t("volume.sheet.a11y")} onClosed={onClosed}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: p.ink800 }]} accessibilityRole="header">
            {t("volume.title")}
          </Text>
          <Text style={[styles.intro, { color: p.ink800 }]}>{t("volume.intro")}</Text>
        </View>
        <Group p={p}>
          <TodayPress
            accessibilityRole="switch"
            accessibilityLabel={t("volume.switch")}
            accessibilityHint={t("volume.switch.sub")}
            accessibilityState={{ checked: enabled }}
            onPress={() => setEnabled(!enabled)}
            pressedScale={0.98}
            style={styles.row}
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: p.ink800 }]}>{t("volume.switch")}</Text>
              <Text style={[styles.rowSub, { color: p.ink500 }]}>{t("volume.switch.sub")}</Text>
            </View>
            <Toggle p={p} on={enabled} />
          </TodayPress>
        </Group>
        <SheetNote p={p}>{engine.canBoost ? t("volume.note.web") : t("volume.note.phone")}</SheetNote>
        <SheetNote p={p}>{t("volume.note.speech")}</SheetNote>
        <SheetNote p={p}>{t("volume.note.unmeasured")}</SheetNote>
        <DoneButton p={p} label={t("common.done")} onPress={onClosed} />
      </SheetShell>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 20, paddingBottom: 16 },
  title: {
    fontFamily: amFonts.display,
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: -0.56,
    textTransform: "uppercase",
  },
  intro: { marginTop: 8, fontFamily: amFonts.regular, fontSize: 15, lineHeight: 23.25 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, minHeight: 64, paddingVertical: 10, paddingLeft: 20, paddingRight: 16 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  rowSub: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
})
