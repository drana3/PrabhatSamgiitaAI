import { useEffect, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { AccountField, InlineError } from "@/components/account/AccountUi"
import { AddButton, ClaimResultCard, ClaimRow, ClaimsFrame, useClaimPicker } from "@/components/authors/ClaimParts"
import { LoadingRows, PillButton, SIDE, StateBlock } from "@/components/authors/AuthorsUi"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { authorsApi } from "@/lib/authors/api"
import { canPick } from "@/lib/authors/claims"
import { AUTHOR_CLAIMS_HREF, authorHref } from "@/lib/authors/constants"
import { say } from "@/lib/authors/text"
import type { AuthorProfileOwner, ClaimCandidate } from "@/lib/authors/types"
import { useT } from "@/lib/i18n"
import { keyboardBehavior } from "@/lib/keyboardBehavior"
import { errorKeyOf } from "@/stores/authorStore"
import { href } from "@/utils/href"

/** Wait after the last keystroke before the library is asked. */
const DELAY_MS = 400
const MIN_LETTERS = 2

/**
 * "Find my recordings": a search page over the whole library, by the name on a recording or a word in its title. It finds
 * what the suggestions cannot (another spelling, a name only in the title). The same choosing and sending as the
 * suggestions screen; the result of each recording is the same ladder (docs/author-profiles.md, "Claiming recordings").
 */
export default function AuthorFindScreen() {
  const t = useT()
  return <ClaimsFrame title={t("authors.find.title")}>{(mine) => <Body mine={mine} />}</ClaimsFrame>
}

type Found = { query: string; items: ClaimCandidate[]; total: number; hasMore: boolean }

function Body({ mine }: { mine: AuthorProfileOwner }) {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const bottom = useScrollBottomInset()
  const api = authorsApi()
  const [text, setText] = useState("")
  const [found, setFound] = useState<Found | null>(null)
  const [loading, setLoading] = useState(false)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ticket = useRef(0)
  const q = text.trim()

  const run = (query: string) => {
    const mineTicket = ++ticket.current
    setLoading(true)
    setError(null)
    api.claimSearch(query).then(
      (page) => {
        if (mineTicket !== ticket.current) return
        setFound({ query, items: page.items, total: page.total, hasMore: page.has_more })
        setLoading(false)
      },
      (failure: unknown) => {
        if (mineTicket !== ticket.current) return
        setError(errorKeyOf(failure))
        setLoading(false)
      },
    )
  }

  useEffect(() => {
    if (q.length < MIN_LETTERS) {
      ticket.current += 1
      setFound(null)
      setLoading(false)
      return undefined
    }
    const timer = setTimeout(() => run(q), DELAY_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const picker = useClaimPicker(() => {
    // keep what is on screen but mark it: ask the same query again so the states are fresh
    if (found) run(found.query)
  })

  const showMore = async () => {
    if (!found || more) return
    setMore(true)
    try {
      const page = await api.claimSearch(found.query, found.items.length)
      setFound({ query: found.query, items: [...found.items, ...page.items], total: page.total, hasMore: page.has_more })
    } catch (failure) {
      setError(errorKeyOf(failure))
    } finally {
      setMore(false)
    }
  }

  const fresh = found && found.query === q ? found : null
  const open = fresh?.items.filter(canPick) ?? []

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={keyboardBehavior(Platform.OS)}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom + 32, gap: 16, paddingTop: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.pad}>
          <Text style={[styles.body, { color: theme.textBody }]}>{t("authors.find.lead")}</Text>
          <AccountField theme={theme} label={t("authors.find.label")} placeholder={t("authors.find.placeholder")} value={text} onChangeText={setText} maxLength={120} autoCapitalize="words" autoCorrect={false} returnKeyType="search" onSubmitEditing={() => q.length >= MIN_LETTERS && run(q)} hint={q.length > 0 && q.length < MIN_LETTERS ? t("authors.find.hint") : null} />
        </View>

        {loading && !fresh ? <LoadingRows theme={theme} rows={3} /> : null}
        {error ? (
          <View style={styles.pad}>
            <InlineError theme={theme} onRetry={() => run(q)} retryLabel={t("common.tryAgain")}>
              {say(t, error)}
            </InlineError>
          </View>
        ) : null}

        {fresh && !fresh.items.length ? (
          <StateBlock theme={theme} title={t("authors.find.none.title", { query: fresh.query })} body={t("authors.find.none.body")} action={t("authors.find.none.alias")} onAction={() => router.push(href(AUTHOR_CLAIMS_HREF))} />
        ) : null}

        {fresh?.items.length ? (
          <View style={styles.pad}>
            <Text style={[styles.count, { color: theme.textMuted }]} accessibilityLiveRegion="polite">
              {t("authors.find.count", { count: fresh.total })}
            </Text>
            <View style={styles.stack}>
              {fresh.items.map((item) => (
                <ClaimRow key={item.recording.id} theme={theme} item={item} level picked={picker.picked.has(item.recording.id)} onToggle={() => picker.toggle(item.recording.id)} />
              ))}
            </View>
            {fresh.hasMore ? <PillButton theme={theme} tone="line" busy={more} label={t("authors.find.more")} onPress={() => void showMore()} /> : null}
          </View>
        ) : null}

        {picker.result ? <ClaimResultCard theme={theme} result={picker.result} onView={mine.status === "published" ? () => router.push(href(authorHref(mine.slug))) : undefined} /> : null}
        {picker.error ? (
          <View style={styles.pad}>
            <InlineError theme={theme}>{say(t, picker.error)}</InlineError>
          </View>
        ) : null}
        {open.length || picker.picked.size ? (
          <View style={styles.pad}>
            <Text style={[styles.note, { color: theme.textMuted }]}>{t("authors.claims.uploaderNote")}</Text>
            <AddButton theme={theme} count={picker.picked.size} busy={picker.busy} onPress={() => void picker.submit()} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: SIDE, gap: 12 },
  stack: { gap: 10 },
  body: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  count: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, letterSpacing: 0.4, textTransform: "uppercase" },
})
