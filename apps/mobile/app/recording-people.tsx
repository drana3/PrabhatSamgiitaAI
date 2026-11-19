import { useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import * as Clipboard from "expo-clipboard"

import { InlineError } from "@/components/account/AccountUi"
import { LoadingRows, PillButton, SectionTitle, SIDE, StateBlock } from "@/components/authors/AuthorsUi"
import { CreditsFrame } from "@/components/credits/CreditsFrame"
import { PersonPicker, type PickedPerson } from "@/components/credits/PersonPicker"
import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAuthorRequest } from "@/hooks/useAuthorRequest"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { AUTHOR_SHARE_ORIGIN } from "@/lib/authors/constants"
import { say } from "@/lib/authors/text"
import { creditsApi } from "@/lib/credits/api"
import { useT } from "@/lib/i18n"
import { CREDIT_ROLES, inviteUrl, MAX_PERFORMERS, roleKey, stateView, summaryParts, visibleCredits, type CreditRole, type CreditView } from "@/lib/kirtan/credits"
import { errorKeyOf } from "@/stores/authorStore"

/**
 * "People on this recording", for the person who added it (docs/co-performers.md): every credit with its state (a plain name,
 * waiting for an answer, confirmed), add a person, change a role, take a name off, and the invite link for a name that has no
 * page yet. A confirmed person is not removed from here: they take themselves off.
 */
export default function RecordingPeopleScreen() {
  const t = useT()
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  return <CreditsFrame title={t("credits.manage.bar")}>{() => (id ? <Body id={id} /> : <Missing />)}</CreditsFrame>
}

function Missing() {
  const t = useT()
  const theme = useSongsTheme()
  return <StateBlock theme={theme} title={t("credits.manage.missing")} />
}

function Body({ id }: { id: string }) {
  const t = useT()
  const theme = useSongsTheme()
  const bottom = useScrollBottomInset()
  const api = creditsApi()
  const list = useAuthorRequest(() => api.list(id), [id])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const run = async (key: string, work: () => Promise<void>) => {
    if (busy) return
    setBusy(key)
    setError(null)
    setCopied(false)
    try {
      await work()
    } catch (failure) {
      setError(errorKeyOf(failure))
    } finally {
      setBusy(null)
    }
  }

  const add = (person: PickedPerson) =>
    run("add", async () => {
      list.setData(await api.add(id, { name: person.name, ...(person.profileId ? { profile_id: person.profileId } : {}), role: "performer" }))
    })

  const remove = (credit: CreditView) =>
    run(credit.id, async () => {
      await api.remove(id, credit.id)
      list.reload()
    })

  const changeRole = (credit: CreditView, role: CreditRole) =>
    run(credit.id, async () => {
      if (credit.role === role) return
      await api.setRole(id, credit.id, role)
      list.reload()
    })

  const copyLink = (credit: CreditView) =>
    run(credit.id, async () => {
      const made = await api.link(id, credit.id)
      await Clipboard.setStringAsync(inviteUrl(AUTHOR_SHARE_ORIGIN, made.token))
      setCopied(true)
    })

  const data = list.data
  const credits = data ? visibleCredits(data.credits, data.can_manage) : []
  const sum = summaryParts(data?.summary)
  const full = credits.length >= MAX_PERFORMERS

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: bottom + 32, gap: 20, paddingTop: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={s.pad}>
        <Text style={[s.heading, { color: theme.textHeading }]} accessibilityRole="header">
          {t("credits.manage.bar")}
        </Text>
        <Text style={[s.body, { color: theme.textBody }]}>{t("credits.manage.lead")}</Text>
        {data ? <Text style={[s.note, { color: theme.textMuted }]}>{t("credits.manage.summary", { confirmed: sum.confirmed, waiting: sum.waiting })}</Text> : null}
      </View>

      {list.loading && !data ? <LoadingRows theme={theme} rows={2} /> : null}
      {list.error ? <StateBlock theme={theme} tone="error" title={t("authors.page.errorTitle")} body={say(t, list.error)} action={t("common.tryAgain")} onAction={list.reload} /> : null}
      {data && !data.can_manage ? <StateBlock theme={theme} title={t("credits.manage.notMine")} /> : null}

      {data?.can_manage ? (
        <>
          {error ? (
            <View style={s.pad}>
              <InlineError theme={theme}>{say(t, error)}</InlineError>
            </View>
          ) : null}
          {copied ? (
            <View style={s.pad}>
              <Text style={[s.note, { color: theme.accentText }]} accessibilityLiveRegion="polite" testID="credit-link-copied">
                {t("credits.manage.linkCopied")}
              </Text>
            </View>
          ) : null}
          <View style={s.pad}>
            {credits.length === 0 ? <Text style={[s.body, { color: theme.textMuted }]}>{t("credits.manage.empty")}</Text> : null}
            {credits.map((credit) => (
              <CreditRow key={credit.id} theme={theme} credit={credit} busy={busy === credit.id} locked={busy !== null} onRemove={() => void remove(credit)} onRole={(role) => void changeRole(credit, role)} onLink={() => void copyLink(credit)} />
            ))}
          </View>
          <View style={s.pad}>
            <SectionTitle theme={theme}>{t("credits.manage.add")}</SectionTitle>
            {full ? <Text style={[s.note, { color: theme.textMuted }]}>{t("credits.problem.limit")}</Text> : <PersonPicker theme={theme} onPick={add} disabled={busy !== null} skipSlugs={credits.flatMap((c) => (c.page ? [c.page.slug] : []))} />}
          </View>
        </>
      ) : null}
    </ScrollView>
  )
}

function CreditRow({ theme, credit, busy, locked, onRemove, onRole, onLink }: { theme: SongsTheme; credit: CreditView; busy: boolean; locked: boolean; onRemove: () => void; onRole: (role: CreditRole) => void; onLink: () => void }) {
  const t = useT()
  const view = stateView(credit.status)
  const accepted = credit.status === "accepted"
  const tone = view.tone === "done" ? theme.accentText : view.tone === "waiting" ? theme.textBody : theme.textMuted
  const shownName = accepted && credit.page ? credit.page.display_name : credit.name
  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]} testID={`credit-row-${credit.id}`}>
      <View style={s.line}>
        <View style={s.grow}>
          <Text style={[s.title, { color: theme.textHeading }]} numberOfLines={2}>
            {shownName}
          </Text>
          <Text style={[s.note, { color: tone }]}>{t(view.key)}</Text>
        </View>
        {accepted ? null : <PillButton theme={theme} size="compact" tone="line" busy={busy} disabled={locked && !busy} label={t("credits.manage.remove")} a11y={`${t("credits.manage.remove")}: ${credit.name}`} onPress={onRemove} />}
      </View>
      {accepted ? (
        <Text style={[s.note, { color: theme.textMuted }]}>{`${t(roleKey(credit.role))}. ${t("credits.manage.onlyThem")}`}</Text>
      ) : (
        <View style={s.roles} accessibilityRole={"radiogroup" as never} accessibilityLabel={t("credits.people.roleFor", { name: credit.name })}>
          {CREDIT_ROLES.map((role) => {
            const on = credit.role === role
            return (
              <KPress key={role} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: locked }} accessibilityLabel={t(roleKey(role))} disabled={locked} onActivate={() => onRole(role)} pressedScale={0.96} style={[s.role, { backgroundColor: on ? theme.ink900 : "transparent", borderColor: on ? theme.ink900 : theme.line }]}>
                <Text style={[s.roleText, { color: on ? theme.onInk : theme.textHeading }]}>{t(roleKey(role))}</Text>
              </KPress>
            )
          })}
        </View>
      )}
      {credit.status === "text" ? (
        <View style={s.stack}>
          <PillButton theme={theme} size="compact" tone="quiet" busy={busy} disabled={locked && !busy} label={t("credits.manage.link")} onPress={onLink} />
          <Text style={[s.note, { color: theme.textMuted }]}>{t("credits.manage.linkHint")}</Text>
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  pad: { paddingHorizontal: SIDE, gap: 12 },
  heading: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 30, letterSpacing: -0.6, textTransform: "uppercase" },
  body: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  card: { gap: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
  title: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 21 },
  line: { flexDirection: "row", alignItems: "center", gap: 12 },
  grow: { flex: 1, gap: 6 },
  stack: { gap: 6 },
  roles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  role: { minHeight: 40, borderRadius: 20, borderWidth: 1, justifyContent: "center", paddingHorizontal: 14 },
  roleText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
})
