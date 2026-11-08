import { useCallback } from "react"
import { Platform, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { DoneButton, Group, SheetNote } from "@/components/profile-v2/SheetBlocks"
import { SheetShell } from "@/components/profile-v2/SheetShell"
import { TodayPress } from "@/components/today/TodayPress"
import { protoFor, type AmProto } from "@/constants/tokens/amToday"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme, useResolvedAppearance } from "@/hooks/useAmTheme"
import { statusBarStyleFor } from "@/lib/appearance"
import { useT } from "@/lib/i18n"
import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"
import { TRANSITION_MAX_SECONDS, TRANSITION_MIN_SECONDS, TRANSITION_STEP_SECONDS, clampTransitionSeconds } from "@/lib/playerV2/playbackPrefs"
import { usePlaybackPrefsStore } from "@/stores/playbackPrefsStore"
import { href } from "@/utils/href"

/**
 * "Smooth transitions" sheet: how long the sound fades out at the end of a track and the next one fades in, 0 (off) to 6 seconds.
 * Two settings: in the Radio (on by default) and in playlists and queues (off by default). Saved at once; Done only closes.
 * How it works and what it cannot do: docs/smooth-transitions.md.
 */
export default function TransitionsScreen() {
  const router = useRouter()
  const t = useT()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const resolved = useResolvedAppearance()
  const radio = usePlaybackPrefsStore((s) => s.transitionRadioSeconds)
  const list = usePlaybackPrefsStore((s) => s.transitionListSeconds)
  const setRadio = usePlaybackPrefsStore((s) => s.setTransitionRadioSeconds)
  const setList = usePlaybackPrefsStore((s) => s.setTransitionListSeconds)

  const onClosed = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(href(NAV_V2_HOME_ROUTE))
  }, [router])

  return (
    <View style={styles.root}>
      <StatusBar style={statusBarStyleFor(resolved)} />
      <SheetShell p={p} label={t("transitions.sheet.a11y")} onClosed={onClosed}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: p.ink800 }]} accessibilityRole="header">
            {t("transitions.title")}
          </Text>
          <Text style={[styles.intro, { color: p.ink800 }]}>{t("transitions.intro")}</Text>
        </View>
        <Group p={p}>
          <Stepper p={p} label={t("transitions.radio")} sub={t("transitions.radio.sub")} value={radio} onChange={setRadio} />
          <Stepper p={p} label={t("transitions.list")} sub={t("transitions.list.sub")} value={list} onChange={setList} />
        </Group>
        <SheetNote p={p}>{t("transitions.note.engine")}</SheetNote>
        {Platform.OS === "web" ? <SheetNote p={p}>{t("transitions.note.web")}</SheetNote> : null}
        <DoneButton p={p} label={t("common.done")} onPress={onClosed} />
      </SheetShell>
    </View>
  )
}

function Stepper({ p, label, sub, value, onChange }: { p: AmProto; label: string; sub: string; value: number; onChange: (seconds: number) => void }) {
  const t = useT()
  const shown = value <= 0 ? t("transitions.off") : t("transitions.seconds", { seconds: String(value) })
  const step = (delta: number) => onChange(clampTransitionSeconds(value + delta))
  return (
    <View style={styles.row} accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: shown }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? TRANSITION_STEP_SECONDS : -TRANSITION_STEP_SECONDS)}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: p.ink800 }]}>{label}</Text>
        <Text style={[styles.rowSub, { color: p.ink500 }]}>{sub}</Text>
      </View>
      <TodayPress
        accessibilityRole="button"
        accessibilityLabel={t("transitions.less")}
        accessibilityState={{ disabled: value <= TRANSITION_MIN_SECONDS }}
        onPress={() => step(-TRANSITION_STEP_SECONDS)}
        pressedScale={0.92}
        style={[styles.round, { borderColor: p.ink500 }, value <= TRANSITION_MIN_SECONDS && styles.dim]}
      >
        <Text style={[styles.glyph, { color: p.ink800 }]}>−</Text>
      </TodayPress>
      <Text style={[styles.value, { color: p.ink800 }]} accessibilityLiveRegion="polite">
        {shown}
      </Text>
      <TodayPress
        accessibilityRole="button"
        accessibilityLabel={t("transitions.more")}
        accessibilityState={{ disabled: value >= TRANSITION_MAX_SECONDS }}
        onPress={() => step(TRANSITION_STEP_SECONDS)}
        pressedScale={0.92}
        style={[styles.round, { borderColor: p.ink500 }, value >= TRANSITION_MAX_SECONDS && styles.dim]}
      >
        <Text style={[styles.glyph, { color: p.ink800 }]}>+</Text>
      </TodayPress>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 28, letterSpacing: -0.56, textTransform: "uppercase" },
  intro: { marginTop: 8, fontFamily: amFonts.regular, fontSize: 15, lineHeight: 23.25 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 72, paddingVertical: 10, paddingLeft: 20, paddingRight: 16 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21 },
  rowSub: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  round: { width: 44, height: 44, borderRadius: 9999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  dim: { opacity: 0.35 },
  glyph: { fontFamily: amFonts.bold, fontSize: 24, lineHeight: 28 },
  value: { minWidth: 44, textAlign: "center", fontFamily: amFonts.bold, fontSize: 15 },
})
