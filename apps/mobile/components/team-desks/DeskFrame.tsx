import type { ReactNode } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { KPress } from "@/components/kirtan/KPress"
import { ActionButton, CORNER, Hint, PILL } from "@/components/song-chords/parts"
import { amFonts } from "@/constants/tokens/amTypography"
import type { DeskLoadStatus } from "@/hooks/useDeskLoad"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { deskDetail, deskFailure } from "@/lib/teamDesks/backend"
import { href } from "@/utils/href"

/**
 * The frame the three team desks share (app/team-words.tsx, team-takedowns.tsx, team-play-flags.tsx): back button, the
 * "Team" over-line, the title, a lead line, then the page's own rows. Same layout as the chord review and the claims desk.
 */
export function DeskFrame({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const top = useScreenTop()
  const clear = useScrollBottomInset()
  return (
    <View style={[s.root, { backgroundColor: theme.page }]}>
      <View style={[s.bar, { paddingTop: top }]}>
        <KPress accessibilityRole="button" accessibilityLabel={t("teamDesk.back")} onPress={() => (router.canGoBack() ? router.back() : router.replace(href("/upload")))} pressedScale={0.95} style={[s.back, { borderColor: theme.line, backgroundColor: theme.card }]}>
          <Text style={[s.backText, { color: theme.textHeading }]}>{t("teamDesk.back")}</Text>
        </KPress>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { paddingBottom: clear + 48 }]}>
        <View>
          <Text style={[s.over, { color: theme.accent }]}>{t("teamDesk.over")}</Text>
          <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {title}
          </Text>
        </View>
        <Text style={[s.lead, { color: theme.textBody }]}>{lead}</Text>
        {children}
      </ScrollView>
    </View>
  )
}

/**
 * Loading, offline, error (with a retry) and denied, for a desk's list. Returns nothing when the list is ready, so the page
 * shows its rows or its own empty sentence.
 */
export function DeskStatus({ status, isEmpty, onRetry }: { status: DeskLoadStatus; isEmpty: boolean; onRetry: () => void }) {
  const t = useT()
  const theme = useSongsTheme()
  if (status === "loading" && isEmpty) return <Hint theme={theme}>{t("teamDesk.loading")}</Hint>
  if (status === "denied") return <Hint theme={theme} tone="danger">{t("teamDesk.denied")}</Hint>
  if (status === "error" || status === "offline") {
    return (
      <View style={s.gap}>
        <Hint theme={theme} tone="danger">{t(status === "offline" ? "teamDesk.offline" : "teamDesk.error")}</Hint>
        <ActionButton theme={theme} tone="quiet" label={t("teamDesk.retry")} onPress={onRetry} />
      </View>
    )
  }
  return null
}

/** The sentence under a card after a failed action, and whether the card is gone (someone decided it first). */
export function failureText(t: ReturnType<typeof useT>, error: unknown, options: { keepOn404?: boolean } = {}): { text: string; gone: boolean } {
  const failure = deskFailure(error)
  // a 404 on the link step means "no such recording", not "the request is gone": keep the card and say what the server said
  if (failure === "gone" && options.keepOn404) return { text: deskDetail(error) ?? t("teamDesk.failed"), gone: false }
  if (failure === "gone") return { text: t("teamDesk.failed.gone"), gone: true }
  if (failure === "network") return { text: t("teamDesk.failed.offline"), gone: false }
  // a refusal with the server's own reason (the waiting time, a missing link) is worth reading as it is
  return { text: failure === "conflict" || failure === "invalid" ? (deskDetail(error) ?? t("teamDesk.failed")) : t("teamDesk.failed"), gone: false }
}

export const deskStyles = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: CORNER, padding: 14, gap: 8 },
  title: { fontFamily: amFonts.bold, fontSize: 19, lineHeight: 24 },
  meta: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  body: { fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gap: { gap: 8 },
  input: { borderWidth: 1.5, borderRadius: CORNER, paddingHorizontal: 12, minHeight: 48, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 10, textAlignVertical: "top", outlineStyle: "none" as never },
  pill: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, borderWidth: 1.5, borderRadius: PILL, paddingHorizontal: 12, paddingVertical: 4, overflow: "hidden", alignSelf: "flex-start" },
})

const s = StyleSheet.create({
  root: { flex: 1 },
  bar: { paddingHorizontal: 24, paddingBottom: 6, flexDirection: "row" },
  back: { minHeight: 44, paddingHorizontal: 16, borderRadius: PILL, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  backText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  content: { paddingHorizontal: 24, gap: 16, paddingTop: 12, maxWidth: 560, width: "100%", alignSelf: "center" },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", marginBottom: 6 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase" },
  lead: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
  gap: { gap: 8 },
})
