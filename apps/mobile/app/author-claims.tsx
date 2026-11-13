import { useCallback, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { AccountField, InlineError } from "@/components/account/AccountUi"
import { AddButton, ClaimResultCard, ClaimRow, ClaimsFrame, useClaimPicker } from "@/components/authors/ClaimParts"
import { KPress } from "@/components/kirtan/KPress"
import { Chip, LoadingRows, PillButton, SectionTitle, SIDE, StateBlock } from "@/components/authors/AuthorsUi"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAuthorRequest } from "@/hooks/useAuthorRequest"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { authorsApi } from "@/lib/authors/api"
import { canPick, reasonKey } from "@/lib/authors/claims"
import { AUTHOR_FIND_HREF, authorHref } from "@/lib/authors/constants"
import { say } from "@/lib/authors/text"
import type { Alias, AuthorProfileOwner, ClaimCandidate, ClaimOut } from "@/lib/authors/types"
import { useT } from "@/lib/i18n"
import { keyboardBehavior } from "@/lib/keyboardBehavior"
import { errorKeyOf } from "@/stores/authorStore"
import { href } from "@/utils/href"

/**
 * "Recordings that may be yours": the library recordings that carry the person's name (and the other names they gave),
 * chosen and sent in one go; the names they are known under; and the state of every request made so far
 * (docs/author-profiles.md, "Claiming recordings"). The person who added a recording is told, not asked.
 */
export default function AuthorClaimsScreen() {
  const t = useT()
  return <ClaimsFrame title={t("authors.claims.bar")}>{(mine) => <Body mine={mine} />}</ClaimsFrame>
}

function Body({ mine }: { mine: AuthorProfileOwner }) {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const bottom = useScrollBottomInset()
  const api = authorsApi()
  const found = useAuthorRequest(() => api.claimSuggestions(), [])
  const requests = useAuthorRequest(() => api.myClaims(), [])
  const reload = useCallback(() => {
    found.reload()
    requests.reload()
  }, [found, requests])
  const picker = useClaimPicker(reload)

  const same = found.data?.same ?? []
  const alike = found.data?.alike ?? []
  const nothing = Boolean(found.data) && !same.length && !alike.length

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={keyboardBehavior(Platform.OS)}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom + 32, gap: 24, paddingTop: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {found.data?.names.length ? (
          <View style={styles.pad}>
            <Text style={[styles.heading, { color: theme.textHeading }]} accessibilityRole="header">
              {t("authors.claims.title")}
            </Text>
            <Text style={[styles.body, { color: theme.textBody }]}>{t("authors.claims.lead", { names: found.data.names.join(", ") })}</Text>
            <Text style={[styles.note, { color: theme.textMuted }]}>{t("authors.claims.uploaderNote")}</Text>
          </View>
        ) : null}

        {found.loading && !found.data ? <LoadingRows theme={theme} rows={3} /> : null}
        {found.error ? <StateBlock theme={theme} tone="error" title={t("authors.page.errorTitle")} body={say(t, found.error)} action={t("common.tryAgain")} onAction={found.reload} /> : null}
        {nothing ? <StateBlock theme={theme} title={t("authors.claims.empty.title")} body={t("authors.claims.empty.body")} action={t("authors.claims.card.find")} onAction={() => router.push(href(AUTHOR_FIND_HREF))} /> : null}

        <Group theme={theme} title={t("authors.claims.same.title")} items={same} picker={picker} />
        <Group theme={theme} title={t("authors.claims.alike.title")} hint={t("authors.claims.alike.hint")} items={alike} picker={picker} />

        {picker.result ? <ClaimResultCard theme={theme} result={picker.result} onView={mine.status === "published" ? () => router.push(href(authorHref(mine.slug))) : undefined} /> : null}
        {picker.error ? (
          <View style={styles.pad}>
            <InlineError theme={theme}>{say(t, picker.error)}</InlineError>
          </View>
        ) : null}
        {same.length + alike.length ? (
          <View style={styles.pad}>
            <AddButton theme={theme} count={picker.picked.size} busy={picker.busy} onPress={() => void picker.submit()} />
          </View>
        ) : null}

        <Aliases theme={theme} onChanged={reload} />

        <View style={styles.pad}>
          <PillButton theme={theme} tone="line" label={t("authors.claims.card.find")} onPress={() => router.push(href(AUTHOR_FIND_HREF))} />
        </View>

        <Requests theme={theme} items={requests.data?.items ?? []} loading={requests.loading && !requests.data} onChanged={reload} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Group({ theme, title, hint, items, picker }: { theme: SongsTheme; title: string; hint?: string; items: ClaimCandidate[]; picker: ReturnType<typeof useClaimPicker> }) {
  const t = useT()
  if (!items.length) return null
  const open = items.filter(canPick).map((i) => i.recording.id)
  const all = open.length > 0 && open.every((id) => picker.picked.has(id))
  return (
    <View style={styles.pad}>
      <SectionTitle theme={theme}>{title}</SectionTitle>
      {hint ? <Text style={[styles.note, { color: theme.textMuted }]}>{hint}</Text> : null}
      {open.length > 1 ? (
        <View style={styles.chips}>
          <Chip theme={theme} label={all ? t("authors.claims.selectNone") : t("authors.claims.selectAll")} active={all} onPress={() => picker.set(open, !all)} />
        </View>
      ) : null}
      <View style={styles.stack}>
        {items.map((item) => (
          <ClaimRow key={item.recording.id} theme={theme} item={item} picked={picker.picked.has(item.recording.id)} onToggle={() => picker.toggle(item.recording.id)} />
        ))}
      </View>
    </View>
  )
}

/** The other names the person is known under: the library may write them differently. */
function Aliases({ theme, onChanged }: { theme: SongsTheme; onChanged: () => void }) {
  const t = useT()
  const api = authorsApi()
  const list = useAuthorRequest(() => api.aliases(), [])
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const items: Alias[] = list.data ?? []

  const add = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      list.setData(await api.addAlias(text))
      setText("")
      onChanged()
    } catch (failure) {
      setError(errorKeyOf(failure))
    } finally {
      setBusy(false)
    }
  }
  const remove = async (alias: Alias) => {
    list.setData(items.filter((a) => a.key !== alias.key))
    try {
      await api.removeAlias(alias.key)
      onChanged()
    } catch (failure) {
      setError(errorKeyOf(failure))
      list.reload()
    }
  }

  return (
    <View style={styles.pad}>
      <SectionTitle theme={theme}>{t("authors.claims.alias.title")}</SectionTitle>
      <Text style={[styles.body, { color: theme.textBody }]}>{t("authors.claims.alias.body")}</Text>
      {items.length ? (
        <View style={styles.chips}>
          {items.map((a) => (
            <KPress key={a.key} accessibilityRole="button" accessibilityLabel={t("authors.claims.alias.remove", { name: a.alias })} onPress={() => void remove(a)} pressedScale={0.95} style={[styles.alias, { backgroundColor: theme.ink900, borderColor: theme.ink900 }]}>
              <Text style={[styles.aliasText, { color: theme.onInk }]}>{`${a.alias}  ×`}</Text>
            </KPress>
          ))}
        </View>
      ) : null}
      <AccountField theme={theme} label={t("authors.claims.alias.label")} placeholder={t("authors.claims.alias.placeholder")} value={text} onChangeText={setText} maxLength={200} autoCapitalize="words" returnKeyType="done" onSubmitEditing={() => void add()} error={error ? say(t, error) : null} hint={t("authors.claims.alias.note")} />
      <PillButton theme={theme} tone="line" busy={busy} disabled={!text.trim()} label={t("authors.claims.alias.add")} onPress={() => void add()} />
    </View>
  )
}

/** Every request made so far, with its state; a waiting or approved one can be taken back. */
function Requests({ theme, items, loading, onChanged }: { theme: SongsTheme; items: ClaimOut[]; loading: boolean; onChanged: () => void }) {
  const t = useT()
  const api = authorsApi()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const withdraw = async (claim: ClaimOut) => {
    setBusy(claim.id)
    setError(null)
    try {
      await api.withdrawClaim(claim.id)
      onChanged()
    } catch (failure) {
      setError(errorKeyOf(failure))
    } finally {
      setBusy(null)
    }
  }

  return (
    <View style={styles.pad}>
      <SectionTitle theme={theme}>{t("authors.claims.mine.title")}</SectionTitle>
      {loading ? <LoadingRows theme={theme} rows={2} /> : null}
      {!loading && !items.length ? <Text style={[styles.body, { color: theme.textBody }]}>{t("authors.claims.mine.empty")}</Text> : null}
      {error ? <InlineError theme={theme}>{say(t, error)}</InlineError> : null}
      <View style={styles.stack}>
        {items.map((claim) => {
          const open = claim.status === "pending" || claim.status === "approved"
          return (
            <View key={claim.id} style={[styles.request, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <View style={styles.flexText}>
                <Text style={[styles.reqTitle, { color: theme.textHeading }]} numberOfLines={2}>
                  {claim.recording.title}
                </Text>
                <Text style={[styles.reqMeta, { color: claim.status === "approved" ? theme.accentText : claim.status === "pending" ? theme.textBody : theme.textMuted }]}>{say(t, `authors.claims.status.${claim.status}`)}</Text>
                {claim.status === "pending" && claim.team_reason ? <Text style={[styles.reqMeta, { color: theme.textMuted }]}>{say(t, reasonKey(claim.team_reason))}</Text> : null}
                {claim.decision_note ? <Text style={[styles.reqMeta, { color: theme.textMuted }]}>{t("authors.claims.mine.note", { note: claim.decision_note })}</Text> : null}
              </View>
              {open ? <PillButton theme={theme} tone="line" busy={busy === claim.id} label={t("authors.claims.mine.withdraw")} a11y={t("authors.claims.mine.withdrawA11y", { title: claim.recording.title })} onPress={() => void withdraw(claim)} /> : null}
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: SIDE, gap: 12 },
  stack: { gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heading: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 30, letterSpacing: -0.6, textTransform: "uppercase" },
  body: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  alias: { minHeight: 40, borderRadius: 20, borderWidth: 1, justifyContent: "center", paddingHorizontal: 14 },
  aliasText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  flexText: { flex: 1, gap: 2 },
  request: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  reqTitle: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  reqMeta: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
})
