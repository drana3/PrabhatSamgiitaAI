import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { canEditPractice, isAvarta, nextPractice, practiceLabel } from "@/lib/kirtan/practice"
import { savePractice, type PracticeFailure } from "@/lib/kirtan/practiceEdit"
import type { Kirtan } from "@/lib/kirtan/types"
import { useAuthStore } from "@/stores/authStore"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * The Avarta Kiirtan mark on a recording's page (docs/kiirtan-practice.md). Everybody sees the tag when the Kiirtan is
 * marked. Only the person who uploaded it, or the team, also gets the switch to mark or unmark it; any other member who
 * thinks the mark is wrong uses the "wrong information" report. Nothing shows for a recording that is not a Kiirtan.
 */

const FAILURE_KEY: Partial<Record<PracticeFailure, string>> = {
  network: "practice.owner.offline",
  signin: "practice.error.signin",
  notUp: "practice.error.notUp",
  forbidden: "practice.error.forbidden",
  removed: "practice.error.removed",
}

export function PracticeTag({ theme, kirtan }: { theme: SongsTheme; kirtan: Kirtan }) {
  const t = useT()
  if (!isAvarta(kirtan)) return null
  return (
    <View style={[styles.tag, { backgroundColor: theme.peach, borderColor: theme.line }]} testID="practice-tag" accessibilityLabel={practiceLabel()}>
      <Text style={[styles.tagText, { color: theme.accent }]}>{t("practice.tag")}</Text>
    </View>
  )
}

export function PracticeBlock({ theme, kirtan: k }: { theme: SongsTheme; kirtan: Kirtan }) {
  const t = useT()
  const mine = useKirtanStore((s) => s.submissions.some((x) => x.id === k.id || (!!k.serverId && x.serverId === k.serverId)))
  const team = useAuthStore((s) => s.isAdmin)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null)
  if (!canEditPractice(k, { mine, team })) return null
  const on = isAvarta(k)
  const toggle = async () => {
    if (busy) return
    setBusy(true)
    setMessage(null)
    const next = nextPractice(!on)
    const result = await savePractice(k, next)
    setBusy(false)
    if (!result.ok) {
      const key = FAILURE_KEY[result.code] ?? "practice.owner.failed"
      setMessage({ text: (t as (key: string) => string)(key), bad: true })
      return
    }
    useKirtanStore.getState().practiceChanged(k.serverId ?? k.id, next)
    setMessage({ text: t("practice.owner.saved"), bad: false })
  }
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]} testID="practice-block">
      <Text style={[styles.title, { color: theme.textHeading }]} accessibilityRole="header">
        {t("practice.owner.title")}
      </Text>
      <Text style={[styles.body, { color: theme.textBody }]}>{t("practice.field.hint")}</Text>
      <KPress
        accessibilityRole="button"
        accessibilityLabel={on ? t("practice.owner.off") : t("practice.owner.on")}
        accessibilityState={{ disabled: busy, busy }}
        onPress={() => void toggle()}
        pressedScale={0.97}
        style={[styles.pill, { backgroundColor: on ? theme.peach : amColors.orange700, opacity: busy ? 0.6 : 1 }]}
      >
        <Text style={[styles.pillText, { color: on ? theme.accent : "#FFFFFF" }]}>{on ? t("practice.owner.off") : t("practice.owner.on")}</Text>
      </KPress>
      {message ? (
        <Text style={[styles.note, { color: message.bad ? theme.dangerText : theme.textHeading }]} accessibilityLiveRegion="polite" accessibilityRole={message.bad ? "alert" : undefined}>
          {message.text}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  tag: { alignSelf: "flex-start", minHeight: 32, paddingHorizontal: 14, borderRadius: 70, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tagText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 18, letterSpacing: 0.3 },
  card: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 10, marginHorizontal: 16 },
  title: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  pill: { alignSelf: "flex-start", minHeight: 44, paddingHorizontal: 18, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  pillText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
})
