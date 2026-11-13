import { useState } from "react"
import { Image, StyleSheet, Text, View } from "react-native"

import { RequiredMark } from "@/components/kirtan/add/KindFields"
import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { pickCover } from "@/lib/kirtan/setCoverPick"
import type { CoverState } from "@/lib/kirtan/sets"

/**
 * The optional cover picture of an event playlist. One button to choose, then the picture with Change and Remove. The
 * picture is made small on the phone (location data goes with it) before it is kept. Says in words why a pick failed.
 */
export function CoverField({ theme, uri, state, disabled, onChange }: { theme: SongsTheme; uri: string; state: CoverState; disabled?: boolean; onChange: (uri: string) => void }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const choose = async () => {
    if (busy || disabled) return
    setBusy(true)
    setProblem(null)
    try {
      const result = await pickCover()
      if (result.status === "ok") onChange(result.uri)
      else if (result.status === "denied") setProblem(t("set.d.coverDenied"))
      else if (result.status === "tooBig") setProblem(t("set.d.coverTooBig"))
      else if (result.status === "error") setProblem(t("set.d.coverError"))
    } finally {
      setBusy(false)
    }
  }
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.textHeading }]}>{t("set.d.cover")}</Text>
        <RequiredMark theme={theme} required={false} />
      </View>
      <Text style={[styles.hint, { color: theme.textBody }]}>{t("set.d.coverHint")}</Text>
      {uri ? <Image source={{ uri }} accessibilityIgnoresInvertColors accessibilityLabel={t("set.d.coverA11y")} resizeMode="cover" style={[styles.preview, { backgroundColor: theme.inner }]} /> : null}
      <View style={styles.actions}>
        <KPress accessibilityRole="button" accessibilityLabel={uri ? t("set.d.coverChange") : t("set.d.coverChoose")} accessibilityState={{ disabled: !!disabled, busy }} onPress={() => void choose()} pressedScale={0.96} style={[styles.pill, { backgroundColor: theme.peach, opacity: disabled ? 0.5 : 1 }]}>
          <Text style={[styles.pillText, { color: theme.accent }]}>{busy ? t("set.d.coverWorking") : uri ? t("set.d.coverChange") : t("set.d.coverChoose")}</Text>
        </KPress>
        {uri ? (
          <KPress accessibilityRole="button" accessibilityLabel={t("set.d.coverRemove")} onPress={() => !disabled && onChange("")} pressedScale={0.94}>
            <Text style={[styles.remove, { color: theme.textBody }]}>{t("set.d.coverRemove")}</Text>
          </KPress>
        ) : null}
      </View>
      {problem ? (
        <Text style={[styles.hint, { color: theme.dangerText }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {problem}
        </Text>
      ) : null}
      {state === "failed" ? (
        <Text style={[styles.hint, { color: theme.dangerText }]} accessibilityLiveRegion="polite">
          {t("set.d.coverFailed")}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: 10 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  preview: { width: "100%", aspectRatio: 4 / 3, borderRadius: 20 },
  actions: { flexDirection: "row", alignItems: "center", gap: 16, flexWrap: "wrap" },
  pill: { height: 40, paddingHorizontal: 18, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  pillText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.4 },
  remove: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, textDecorationLine: "underline", paddingVertical: 6 },
})
