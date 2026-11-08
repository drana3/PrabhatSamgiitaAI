import { useCallback, useEffect, useState, type ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Stack, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AccountBar, topInset } from "@/components/account/AccountUi"
import { DemoNote, LoadingRows, PillButton, SIDE, StateBlock } from "@/components/authors/AuthorsUi"
import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { authorsApi } from "@/lib/authors/api"
import { canPick, clock, reasonKey } from "@/lib/authors/claims"
import { AUTHORS_HREF, BECOME_AUTHOR_HREF } from "@/lib/authors/constants"
import { isSignedIn } from "@/lib/authors/session"
import { say } from "@/lib/authors/text"
import type { AuthorProfileOwner, ClaimCandidate, ClaimsCreated } from "@/lib/authors/types"
import { useT } from "@/lib/i18n"
import { kindLabel } from "@/lib/kirtan/kind"
import { errorKeyOf, useAuthorStore } from "@/stores/authorStore"
import { href } from "@/utils/href"

/**
 * The frame of the two claim screens: the top bar, the sign-in / no page / error states, then `children(profile)`.
 * Same guards as the author's own page (app/my-author.tsx).
 */
export function ClaimsFrame({ title, children }: { title: string; children: (mine: AuthorProfileOwner) => ReactNode }) {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const api = authorsApi()
  const load = useAuthorStore((s) => s.load)
  const mine = useAuthorStore((s) => s.mine)
  const storeError = useAuthorStore((s) => s.errorKey)
  const refresh = useAuthorStore((s) => s.refresh)
  const signedIn = isSignedIn(api)

  useEffect(() => {
    if (signedIn && load === "idle") void refresh()
  }, [signedIn, load, refresh])

  const back = () => (router.canGoBack() ? router.back() : router.replace(href(AUTHORS_HREF)))
  const frame = (child: ReactNode) => (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <AccountBar theme={theme} title={title} onBack={back} inset={topInset(insets.top)} />
      {child}
    </View>
  )

  if (!signedIn) return frame(<StateBlock theme={theme} title={t("authors.become.signin.title")} body={t("authors.become.signin.body")} action={t("authors.become.signin.action")} onAction={() => router.push(href("/signin"))} />)
  if (load === "idle" || load === "loading") return frame(<LoadingRows theme={theme} rows={3} />)
  if (load === "error") return frame(<StateBlock theme={theme} tone="error" title={t("authors.page.errorTitle")} body={say(t, storeError ?? "authors.error.generic")} action={t("common.tryAgain")} onAction={() => void refresh()} />)
  if (!mine) return frame(<StateBlock theme={theme} title={t("authors.mine.none.title")} body={t("authors.mine.none.body")} action={t("authors.cta.become")} onAction={() => router.replace(href(BECOME_AUTHOR_HREF))} />)
  return frame(
    <>
      {api.demo ? <DemoNote theme={theme} /> : null}
      {children(mine)}
    </>,
  )
}

/** A square tick box drawn with views (no icon font on the page). */
function TickBox({ theme, on }: { theme: SongsTheme; on: boolean }) {
  return (
    <View style={[styles.box, { borderColor: on ? theme.brand : theme.line, backgroundColor: on ? theme.brand : "transparent" }]}>
      {on ? <View style={[styles.tick, { borderColor: theme.onBrand }]} /> : null}
    </View>
  )
}

/**
 * One recording that may be the person's: tick box, title, how it is credited, who added it, and where the request
 * would go (the page at once, or the team first, and why). A recording already asked for shows its state instead.
 */
export function ClaimRow({
  theme,
  item,
  picked,
  onToggle,
  level,
}: {
  theme: SongsTheme
  item: ClaimCandidate
  picked: boolean
  onToggle: () => void
  /** show the match level (the search page, where all levels mix) */
  level?: boolean
}) {
  const t = useT()
  const r = item.recording
  const open = canPick(item)
  const meta = [kindLabel(r.kind as never), clock(r.duration_sec)].filter(Boolean).join(" · ")
  const source = r.library ? t("authors.claims.row.library") : t("authors.claims.row.addedBy", { name: r.added_by })
  const where =
    item.claim_status && !open
      ? say(t, `authors.claims.status.${item.claim_status}`)
      : item.route === "self"
        ? t("authors.claims.route.self")
        : `${t("authors.claims.route.team")}${item.team_reason ? `. ${say(t, reasonKey(item.team_reason))}` : ""}`
  const body = (
    <>
      {open ? <TickBox theme={theme} on={picked} /> : null}
      <View style={styles.text}>
        {level ? <Text style={[styles.level, { color: theme.accentText }]}>{say(t, `authors.find.level.${item.level}`)}</Text> : null}
        <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={2}>
          {r.title}
        </Text>
        <Text style={[styles.meta, { color: theme.textBody }]} numberOfLines={1}>
          {meta}
        </Text>
        <Text style={[styles.meta, { color: theme.textBody }]} numberOfLines={2}>
          {t("authors.claims.row.credit", { credit: r.author || "—" })}
        </Text>
        <Text style={[styles.meta, { color: theme.textMuted }]} numberOfLines={1}>
          {source}
        </Text>
        <Text style={[styles.meta, { color: open ? (item.route === "self" ? theme.accentText : theme.textBody) : theme.accentText }]}>{where}</Text>
        {level && item.level === "title" ? <Text style={[styles.meta, { color: theme.textMuted }]}>{t("authors.find.titleNote")}</Text> : null}
      </View>
    </>
  )
  const frame = [styles.row, { backgroundColor: theme.card, borderColor: picked ? theme.brand : theme.line }]
  if (!open) return <View style={frame}>{body}</View>
  return (
    <KPress accessibilityRole="checkbox" accessibilityState={{ checked: picked }} accessibilityLabel={t("authors.claims.row.checkA11y", { title: r.title })} onPress={onToggle} pressedScale={0.98} style={frame}>
      {body}
    </KPress>
  )
}

/** The chosen recordings and the call that sends them. */
export function useClaimPicker(onChanged: () => void) {
  const api = authorsApi()
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ClaimsCreated | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggle = useCallback((id: string) => {
    setResult(null)
    setPicked((old) => {
      const next = new Set(old)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const set = useCallback((ids: string[], on: boolean) => {
    setResult(null)
    setPicked((old) => {
      const next = new Set(old)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [])
  const submit = useCallback(async () => {
    if (!picked.size || busy) return
    setBusy(true)
    setError(null)
    try {
      const created = await api.createClaims([...picked])
      setResult(created)
      setPicked(new Set())
      onChanged()
    } catch (failure) {
      setError(errorKeyOf(failure))
    } finally {
      setBusy(false)
    }
  }, [api, picked, busy, onChanged])
  return { picked, toggle, set, submit, busy, result, error, dismiss: () => setResult(null) }
}

/** What happened to the recordings that were sent: added now, sent to the team, left as they were. */
export function ClaimResultCard({ theme, result, onView }: { theme: SongsTheme; result: ClaimsCreated; onView?: () => void }) {
  const t = useT()
  const skipped = result.results.length - result.approved - result.pending
  return (
    <View style={[styles.result, { backgroundColor: theme.card, borderColor: theme.line }]} accessibilityLiveRegion="polite">
      {result.approved ? <Text style={[styles.resultLine, { color: theme.textHeading }]}>{t("authors.claims.result.approved", { count: result.approved })}</Text> : null}
      {result.pending ? <Text style={[styles.resultLine, { color: theme.textHeading }]}>{t("authors.claims.result.pending", { count: result.pending })}</Text> : null}
      {skipped > 0 ? <Text style={[styles.meta, { color: theme.textBody }]}>{t("authors.claims.result.skipped", { count: skipped })}</Text> : null}
      {result.approved && onView ? <PillButton theme={theme} tone="line" label={t("authors.claims.result.view")} onPress={onView} /> : null}
    </View>
  )
}

/** The button that sends the chosen recordings, with the count in it. */
export function AddButton({ theme, count, busy, onPress }: { theme: SongsTheme; count: number; busy: boolean; onPress: () => void }) {
  const t = useT()
  return <PillButton theme={theme} busy={busy} disabled={count === 0} label={count ? t("authors.claims.add", { count }) : t("authors.claims.addNone")} onPress={onPress} />
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5 },
  text: { flex: 1, gap: 2 },
  level: { fontFamily: amFonts.bold, fontSize: 11, lineHeight: 15, letterSpacing: 1, textTransform: "uppercase" },
  title: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 21 },
  meta: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 2 },
  tick: { width: 12, height: 7, borderLeftWidth: 2.5, borderBottomWidth: 2.5, transform: [{ rotate: "-45deg" }, { translateY: -1 }] },
  result: { marginHorizontal: SIDE, borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  resultLine: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
})
