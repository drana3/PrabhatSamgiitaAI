import { useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"

import { InlineError } from "@/components/account/AccountUi"
import { LoadingRows, PillButton, SIDE, StateBlock } from "@/components/authors/AuthorsUi"
import { CreditsFrame } from "@/components/credits/CreditsFrame"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAuthorRequest } from "@/hooks/useAuthorRequest"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { say } from "@/lib/authors/text"
import { creditsApi } from "@/lib/credits/api"
import { useT } from "@/lib/i18n"
import { daysLeft, inviteWords, type InviteView } from "@/lib/kirtan/credits"
import { errorKeyOf } from "@/stores/authorStore"

/**
 * "Is this you?": the invitations other people made for the person's author page (docs/co-performers.md). Three answers:
 * "Yes, it's me" (the recording shows on the page), "Not me" (nothing shows), "Not me, and do not let this person name me".
 * Nobody is told the reason of a "no".
 */
export default function CreditInvitesScreen() {
  const t = useT()
  return <CreditsFrame title={t("credits.invites.bar")} needPage>{() => <Body />}</CreditsFrame>
}

function Body() {
  const t = useT()
  const theme = useSongsTheme()
  const bottom = useScrollBottomInset()
  const list = useAuthorRequest(() => creditsApi().invites(), [])
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<"yes" | "no" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const answer = async (invite: InviteView, how: "yes" | "no" | "block") => {
    if (busy) return
    setBusy(invite.credit_id)
    setError(null)
    try {
      if (how === "yes") await creditsApi().accept(invite.credit_id)
      else await creditsApi().decline(invite.credit_id, how === "block")
      list.setData((list.data ?? []).filter((i) => i.credit_id !== invite.credit_id))
      setDone(how === "yes" ? "yes" : "no")
    } catch (failure) {
      setError(errorKeyOf(failure))
    } finally {
      setBusy(null)
    }
  }

  const invites = list.data ?? []
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: bottom + 32, gap: 16, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
      <View style={s.pad}>
        <Text style={[s.heading, { color: theme.textHeading }]} accessibilityRole="header">
          {t("credits.invites.title")}
        </Text>
        <Text style={[s.body, { color: theme.textBody }]}>{t("credits.invites.lead")}</Text>
      </View>
      {done ? (
        <View style={s.pad}>
          <Text style={[s.note, { color: theme.accentText }]} accessibilityLiveRegion="polite" testID="invites-done">
            {done === "yes" ? t("credits.invites.doneYes") : t("credits.invites.doneNo")}
          </Text>
        </View>
      ) : null}
      {error ? (
        <View style={s.pad}>
          <InlineError theme={theme}>{say(t, error)}</InlineError>
        </View>
      ) : null}
      {list.loading && !list.data ? <LoadingRows theme={theme} rows={2} /> : null}
      {list.error ? <StateBlock theme={theme} tone="error" title={t("authors.page.errorTitle")} body={say(t, list.error)} action={t("common.tryAgain")} onAction={list.reload} /> : null}
      {list.data && invites.length === 0 ? <StateBlock theme={theme} title={t("credits.invites.empty.title")} body={t("credits.invites.empty.body")} /> : null}
      <View style={s.pad}>
        {invites.map((invite) => (
          <InviteCard key={invite.credit_id} theme={theme} invite={invite} busy={busy === invite.credit_id} locked={busy !== null} onAnswer={(how) => void answer(invite, how)} />
        ))}
      </View>
    </ScrollView>
  )
}

function InviteCard({ theme, invite, busy, locked, onAnswer }: { theme: SongsTheme; invite: InviteView; busy: boolean; locked: boolean; onAnswer: (how: "yes" | "no" | "block") => void }) {
  const t = useT()
  const words = inviteWords(invite)
  const left = daysLeft(invite, Date.now())
  const until = invite.expires_at ? new Date(invite.expires_at).toLocaleDateString() : null
  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]} testID={`invite-${invite.credit_id}`}>
      <Text style={[s.title, { color: theme.textHeading }]}>{say(t, `credits.invites.${invite.role}`, { who: words.who, title: words.title })}</Text>
      {until && left !== null ? (
        <Text style={[s.note, { color: theme.textMuted }]}>{t("credits.invites.until", { date: until })}</Text>
      ) : null}
      <View style={s.actions}>
        <PillButton theme={theme} size="compact" label={t("credits.invites.yes")} busy={busy} disabled={locked && !busy} onPress={() => onAnswer("yes")} />
        <PillButton theme={theme} size="compact" tone="line" label={t("credits.invites.no")} disabled={locked} onPress={() => onAnswer("no")} />
      </View>
      <PillButton theme={theme} size="compact" tone="quiet" label={t("credits.invites.block")} disabled={locked} onPress={() => onAnswer("block")} />
    </View>
  )
}

const s = StyleSheet.create({
  pad: { paddingHorizontal: SIDE, gap: 12 },
  heading: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 30, letterSpacing: -0.6, textTransform: "uppercase" },
  body: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  card: { gap: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
  title: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
})
