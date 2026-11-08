import { useCallback, useEffect, useState } from "react"
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native"
import { Stack, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AccountBar, topInset } from "@/components/account/AccountUi"
import { AuthorAvatar, Chip, DemoNote, LoadingRows, PillButton, SectionTitle, SIDE, StateBlock, WEB_THUMB } from "@/components/authors/AuthorsUi"
import { ClaimsCard } from "@/components/authors/ClaimsCard"
import { OwnerStatsView } from "@/components/authors/StatsViews"
import { Toast } from "@/components/songs-v2/Toast"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAuthorRequest } from "@/hooks/useAuthorRequest"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { authorsApi } from "@/lib/authors/api"
import { isSignedIn } from "@/lib/authors/session"
import { ADD_PLAYLIST_HREF, ADD_RECORDING_HREF, AUTHORS_HREF, AUTHOR_EDIT_HREF, BECOME_AUTHOR_HREF, authorHref, authorShareUrl } from "@/lib/authors/constants"
import { copyAuthorLink, shareAuthor } from "@/lib/authors/share"
import { reviewKey, say } from "@/lib/authors/text"
import type { AuthorProfileOwner, OwnerRecording, StatsPeriod } from "@/lib/authors/types"
import { useT } from "@/lib/i18n"
import { kindLabel } from "@/lib/kirtan/kind"
import { errorKeyOf, useAuthorStore } from "@/stores/authorStore"
import { href } from "@/utils/href"

const PERIODS: StatsPeriod[] = [7, 30, 90]

function statusKey(p: AuthorProfileOwner): "draft" | "published" | "review" | "suspended" {
  if (p.status === "suspended") return "suspended"
  if (p.status === "draft" && p.review_needed) return "review"
  return p.status
}

/** The author's own page: state, share, add recordings, statistics, which recordings are shown, edit, unpublish, delete. */
export default function MyAuthorScreen() {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const bottom = useScrollBottomInset()
  const api = authorsApi()
  const load = useAuthorStore((s) => s.load)
  const mine = useAuthorStore((s) => s.mine)
  const storeError = useAuthorStore((s) => s.errorKey)
  const refresh = useAuthorStore((s) => s.refresh)
  const setMine = useAuthorStore((s) => s.setMine)
  const signedIn = isSignedIn(api)
  const [toast, setToast] = useState<string | null>(null)

  const flash = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast((current) => (current === message ? null : current)), 2200)
  }, [])

  useEffect(() => {
    if (signedIn && load === "idle") void refresh()
  }, [signedIn, load, refresh])

  const back = () => (router.canGoBack() ? router.back() : router.replace(href(AUTHORS_HREF)))
  const frame = (child: React.ReactNode) => (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <AccountBar theme={theme} title={t("authors.mine.title")} onBack={back} inset={topInset(insets.top)} />
      {child}
    </View>
  )

  if (!signedIn) return frame(<StateBlock theme={theme} title={t("authors.become.signin.title")} body={t("authors.become.signin.body")} action={t("authors.become.signin.action")} onAction={() => router.push(href("/signin"))} />)
  if (load === "idle" || load === "loading") return frame(<LoadingRows theme={theme} rows={3} />)
  if (load === "error") return frame(<StateBlock theme={theme} tone="error" title={t("authors.page.errorTitle")} body={say(t, storeError ?? "authors.error.generic")} action={t("common.tryAgain")} onAction={() => void refresh()} />)
  if (!mine) return frame(<StateBlock theme={theme} title={t("authors.mine.none.title")} body={t("authors.mine.none.body")} action={t("authors.cta.become")} onAction={() => router.replace(href(BECOME_AUTHOR_HREF))} />)

  return frame(
    <>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom + 32, gap: 28 }} showsVerticalScrollIndicator={false}>
        {api.demo ? <DemoNote theme={theme} /> : null}
        <Overview profile={mine} flash={flash} onChange={setMine} />
        <AddButtons />
        <ClaimsCard />
        <StatsSection />
        <RecordingsSection profile={mine} flash={flash} />
        <Manage profile={mine} flash={flash} onChange={setMine} />
      </ScrollView>
      <Toast message={toast} theme={theme} />
    </>,
  )
}

function Overview({ profile, flash, onChange }: { profile: AuthorProfileOwner; flash: (m: string) => void; onChange: (p: AuthorProfileOwner) => void }) {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const api = authorsApi()
  const [busy, setBusy] = useState(false)
  const key = statusKey(profile)

  const publish = async () => {
    setBusy(true)
    try {
      onChange(await api.publish())
    } catch (failure) {
      flash(say(t, errorKeyOf(failure)))
    } finally {
      setBusy(false)
    }
  }
  const copy = async () => flash((await copyAuthorLink(profile.slug)) ? t("authors.share.copied") : t("authors.error.generic"))
  const share = async () => {
    const outcome = await shareAuthor({ slug: profile.slug, name: profile.display_name }, t("authors.share.intro", { name: profile.display_name }))
    if (outcome === "copied") flash(t("authors.share.copied"))
    if (outcome === "failed") flash(t("authors.error.generic"))
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <View style={styles.identity}>
        <AuthorAvatar slug={profile.slug} name={profile.display_name} photoUrl={profile.photo_url} size={64} />
        <View style={styles.flexText}>
          <Text style={[styles.name, { color: theme.textHeading }]} numberOfLines={2}>
            {profile.display_name}
          </Text>
          <Text style={[styles.status, { color: key === "suspended" ? theme.dangerText : theme.accentText }]} accessibilityLiveRegion="polite">
            {say(t, `authors.status.${key}`)}
          </Text>
        </View>
      </View>
      {key === "review" || (profile.review_needed && key === "published") ? (
        <Text style={[styles.body, { color: theme.textBody }]}>{say(t, reviewKey(profile.review_reason))}</Text>
      ) : null}
      {key === "suspended" ? <Text style={[styles.body, { color: theme.dangerText }]}>{profile.suspended_reason ? t("authors.suspended.reason", { reason: profile.suspended_reason }) : t("authors.suspended.body")}</Text> : null}
      {key === "published" && !profile.indexable ? <Text style={[styles.body, { color: theme.textBody }]}>{t("authors.mine.notIndexed")}</Text> : null}
      {key === "draft" ? <Text style={[styles.body, { color: theme.textBody }]}>{t("authors.mine.draftBody")}</Text> : null}
      <Text style={[styles.link, { color: theme.textHeading }]} selectable accessibilityLabel={t("authors.mine.linkA11y")}>
        {authorShareUrl(profile.slug).replace(/^https?:\/\//, "")}
      </Text>
      <View style={styles.row}>
        {key === "published" ? (
          <View style={styles.headerStack}>
            <PillButton theme={theme} label={t("authors.mine.view")} onPress={() => router.push(href(authorHref(profile.slug)))} />
            <View style={styles.row}>
              <PillButton theme={theme} flex tone="line" label={t("common.share")} onPress={() => void share()} />
              <PillButton theme={theme} flex tone="line" label={t("authors.mine.copy")} onPress={() => void copy()} />
            </View>
          </View>
        ) : null}
        {key === "draft" ? <PillButton theme={theme} flex busy={busy} label={t("authors.mine.publish")} onPress={() => void publish()} /> : null}
      </View>
    </View>
  )
}

function AddButtons() {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  return (
    <View style={styles.pad}>
      <SectionTitle theme={theme}>{t("authors.mine.add.title")}</SectionTitle>
      <Text style={[styles.body, { color: theme.textBody, marginTop: 6 }]}>{t("authors.mine.add.body")}</Text>
      <View style={styles.stack}>
        <PillButton theme={theme} label={t("authors.mine.add.recording")} onPress={() => router.push(href(ADD_RECORDING_HREF))} />
        <PillButton theme={theme} tone="line" label={t("authors.mine.add.playlist")} onPress={() => router.push(href(ADD_PLAYLIST_HREF))} />
      </View>
    </View>
  )
}

function StatsSection() {
  const t = useT()
  const theme = useSongsTheme()
  const api = authorsApi()
  const [days, setDays] = useState<StatsPeriod>(30)
  const { data, error, loading, reload } = useAuthorRequest(() => api.myStats(days), [days])
  return (
    <View style={styles.pad}>
      <SectionTitle theme={theme}>{t("authors.mine.stats.title")}</SectionTitle>
      <View style={styles.periods} accessibilityRole="tablist">
        {PERIODS.map((p) => (
          <Chip key={p} theme={theme} label={t("authors.mine.stats.days", { count: p })} active={days === p} onPress={() => setDays(p)} />
        ))}
      </View>
      {loading && !data ? <LoadingRows theme={theme} rows={2} /> : null}
      {error ? <StateBlock theme={theme} tone="error" title={t("authors.page.errorTitle")} body={say(t, error)} action={t("common.tryAgain")} onAction={reload} /> : null}
      {data && !error ? <OwnerStatsView theme={theme} stats={data} demo={api.demo} /> : null}
    </View>
  )
}

function RecordingsSection({ profile, flash }: { profile: AuthorProfileOwner; flash: (m: string) => void }) {
  const t = useT()
  const theme = useSongsTheme()
  const api = authorsApi()
  const { data, error, loading, reload, setData } = useAuthorRequest(() => api.myRecordings(), [])

  const toggle = async (row: OwnerRecording, shown: boolean) => {
    const apply = (value: boolean) => setData((old) => (old ? { ...old, items: old.items.map((r) => (r.recording.id === row.recording.id ? { ...r, shown: value } : r)) } : old))
    apply(shown)
    try {
      await api.setShown(row.recording.id, shown)
    } catch (failure) {
      apply(!shown)
      flash(say(t, errorKeyOf(failure)))
    }
  }

  return (
    <View style={styles.pad}>
      <SectionTitle theme={theme}>{t("authors.mine.recordings.title")}</SectionTitle>
      <Text style={[styles.body, { color: theme.textBody, marginTop: 6 }]}>{profile.include_uploads === "all" ? t("authors.mine.recordings.allBody") : t("authors.mine.recordings.chosenBody")}</Text>
      {loading && !data ? <LoadingRows theme={theme} rows={3} /> : null}
      {error ? <StateBlock theme={theme} tone="error" title={t("authors.page.errorTitle")} body={say(t, error)} action={t("common.tryAgain")} onAction={reload} /> : null}
      {data && !data.items.length ? <StateBlock theme={theme} title={t("authors.mine.recordings.empty")} body={t("authors.mine.recordings.emptyBody")} /> : null}
      <View style={styles.stack}>
        {data?.items.map((row) => (
          <View key={row.recording.id} style={[styles.recording, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <View style={styles.flexText}>
              <Text style={[styles.recTitle, { color: theme.textHeading }]} numberOfLines={2}>
                {row.recording.title}
              </Text>
              <Text style={[styles.recMeta, { color: theme.textBody }]}>{`${kindLabel(row.recording.kind)} · ${t("authors.count.plays", { count: row.recording.plays ?? 0 })}`}</Text>
              <Text style={[styles.recMeta, { color: row.shown ? theme.accentText : theme.textMuted }]}>{row.shown ? t("authors.mine.recordings.shown") : t("authors.mine.recordings.hidden")}</Text>
            </View>
            <Switch
              accessibilityLabel={t("authors.mine.recordings.switchA11y", { title: row.recording.title })}
              value={row.shown}
              onValueChange={(v) => void toggle(row, v)}
              trackColor={{ true: theme.brand, false: theme.line }}
              thumbColor="#FFFFFF"
              {...WEB_THUMB}
            />
          </View>
        ))}
      </View>
    </View>
  )
}

function Manage({ profile, flash, onChange }: { profile: AuthorProfileOwner; flash: (m: string) => void; onChange: (p: AuthorProfileOwner | null) => void }) {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const api = authorsApi()
  const [busy, setBusy] = useState<"unpublish" | "delete" | null>(null)
  const [confirming, setConfirming] = useState(false)

  const unpublish = async () => {
    setBusy("unpublish")
    try {
      onChange(await api.unpublish())
      flash(t("authors.mine.unpublished"))
    } catch (failure) {
      flash(say(t, errorKeyOf(failure)))
    } finally {
      setBusy(null)
    }
  }
  const remove = async () => {
    setBusy("delete")
    try {
      await api.remove()
      onChange(null)
      router.replace(href(AUTHORS_HREF))
    } catch (failure) {
      flash(say(t, errorKeyOf(failure)))
      setBusy(null)
    }
  }

  return (
    <View style={styles.pad}>
      <SectionTitle theme={theme}>{t("authors.mine.manage.title")}</SectionTitle>
      <View style={styles.stack}>
        <PillButton theme={theme} tone="line" label={t("authors.mine.edit")} onPress={() => router.push(href(AUTHOR_EDIT_HREF))} />
        {profile.status === "published" ? <PillButton theme={theme} tone="line" busy={busy === "unpublish"} label={t("authors.mine.unpublish")} onPress={() => void unpublish()} /> : null}
        {!confirming ? (
          <PillButton theme={theme} tone="danger" label={t("authors.mine.delete")} onPress={() => setConfirming(true)} />
        ) : (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.dangerText }]} accessibilityRole="alert">
            <Text style={[styles.recTitle, { color: theme.textHeading }]}>{t("authors.mine.delete.title")}</Text>
            <Text style={[styles.body, { color: theme.textBody }]}>{t("authors.mine.delete.body")}</Text>
            <View style={styles.row}>
              <PillButton theme={theme} flex tone="line" label={t("common.cancel")} onPress={() => setConfirming(false)} />
              <PillButton theme={theme} flex tone="danger" busy={busy === "delete"} label={t("authors.mine.delete.confirm")} onPress={() => void remove()} />
            </View>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pad: { paddingHorizontal: SIDE, gap: 12 },
  card: { marginHorizontal: SIDE, borderRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  identity: { flexDirection: "row", alignItems: "center", gap: 14 },
  flexText: { flex: 1, gap: 2 },
  name: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.4 },
  status: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
  body: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
  link: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  headerStack: { flexBasis: "100%", gap: 8 },
  stack: { gap: 10 },
  periods: { flexDirection: "row", gap: 8 },
  recording: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  recTitle: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  recMeta: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
})
