import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { LanguagePicker, type LanguageValue } from "@/components/kirtan/add/KindFields"
import { KPress } from "@/components/kirtan/KPress"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { addLanguage, needsLanguage, type AddLanguageFailure } from "@/lib/kirtan/addLanguage"
import type { Kirtan } from "@/lib/kirtan/types"
import { useAuthStore } from "@/stores/authStore"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * "Add the language" for an OLD Bhajan or Spiritual song stored without one. It shows only to the person who uploaded
 * the recording (or the team), only while the language is missing; a language already there is never replaced.
 * `card` is the block on the recording page; `inline` is the small line under a row in My uploads.
 * Picking a language in the sheet saves it at once; a failure keeps the prompt and says why in a plain sentence.
 */

type Phase = { name: "idle" } | { name: "saving" } | { name: "done" } | { name: "error"; code: AddLanguageFailure }

export function AddLanguagePrompt({ theme, kirtan: k, variant }: { theme: SongsTheme; kirtan: Kirtan; variant: "card" | "inline" }) {
  const t = useT()
  const mine = useKirtanStore((s) => s.submissions.some((x) => x.id === k.id || (!!k.serverId && x.serverId === k.serverId)))
  const team = useAuthStore((s) => s.isAdmin)
  const [picking, setPicking] = useState(false)
  const [phase, setPhase] = useState<Phase>({ name: "idle" })

  const show = needsLanguage(k, { mine, team })
  // after a save the language is in the store, so the prompt would vanish at once: keep the "done" line for a moment
  if (!show && phase.name !== "done") return null

  const save = async (value: LanguageValue) => {
    setPicking(false)
    if (!value.language) return
    setPhase({ name: "saving" })
    const result = await addLanguage(k, { language: value.language, languageOther: value.languageOther })
    if (!result.ok) {
      setPhase({ name: "error", code: result.code })
      return
    }
    useKirtanStore.getState().languageAdded(k.serverId ?? k.id, { language: value.language, languageOther: value.languageOther })
    setPhase({ name: "done" })
  }

  const busy = phase.name === "saving"
  const card = variant === "card"
  const message =
    phase.name === "done" ? t("rec.addLang.done") : phase.name === "error" ? (t as (key: string) => string)(`rec.addLang.error.${phase.code}`) : null

  return (
    <View
      style={[card ? styles.card : styles.inline, { backgroundColor: card ? theme.peach : "transparent", borderColor: card ? theme.line : "transparent" }]}
      testID={`add-language-${variant}`}
    >
      {card ? (
        <>
          <Text style={[styles.title, { color: theme.textHeading }]} accessibilityRole="header">
            {t("rec.addLang.title")}
          </Text>
          <Text style={[styles.body, { color: theme.textBody }]}>{t("rec.addLang.body")}</Text>
        </>
      ) : phase.name === "idle" || phase.name === "saving" ? (
        <Text style={[styles.note, { color: theme.textBody }]}>{t("rec.addLang.short")}</Text>
      ) : null}
      {message ? (
        <Text
          style={[styles.note, { color: phase.name === "error" ? theme.dangerText : theme.textHeading }]}
          accessibilityRole={phase.name === "error" ? "alert" : undefined}
          accessibilityLiveRegion="polite"
        >
          {message}
        </Text>
      ) : null}
      {phase.name !== "done" ? (
        <View style={styles.actions}>
          <KPress
            accessibilityRole="button"
            accessibilityLabel={t("rec.addLang.button")}
            accessibilityState={{ disabled: busy, busy }}
            onPress={() => !busy && setPicking(true)}
            pressedScale={0.96}
            style={[styles.pill, { backgroundColor: amColors.orange700, opacity: busy ? 0.6 : 1 }]}
          >
            <Text style={styles.pillText}>{busy ? t("rec.addLang.saving") : t("rec.addLang.button")}</Text>
          </KPress>
        </View>
      ) : null}
      <LanguagePicker visible={picking} value={{ language: null, languageOther: "" }} allowClear={false} onPick={save} onClose={() => setPicking(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 8, marginHorizontal: 16 },
  inline: { gap: 6, paddingHorizontal: 4 },
  title: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" },
  pill: { minHeight: 40, paddingHorizontal: 16, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  pillText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18, color: "#FFFFFF" },
})
