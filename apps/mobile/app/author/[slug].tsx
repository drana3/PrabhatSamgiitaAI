import { useCallback, useEffect, useMemo, useState } from "react"
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { Shuffle } from "lucide-react-native"

import { AuthorHero } from "@/components/authors/AuthorHero"
import { Chip, DemoNote, LoadingRows, PillButton, SectionTitle, SIDE, StateBlock } from "@/components/authors/AuthorsUi"
import { EditorialPage, ShelvesPage, type VariantProps } from "@/components/authors/PageVariants"
import { PublicStatsStrip } from "@/components/authors/StatsViews"
import { KirtanMenuSheet, KirtanShareSheet } from "@/components/kirtan/KirtanMenus"
import { KirtanRow, PlayFilled } from "@/components/kirtan/KirtanParts"
import { KPress } from "@/components/kirtan/KPress"
import { Toast } from "@/components/songs-v2/Toast"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAuthorRequest } from "@/hooks/useAuthorRequest"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { authorsApi } from "@/lib/authors/api"
import { isSignedIn } from "@/lib/authors/session"
import { AUTHORS_HREF, MY_AUTHOR_HREF, RECORDINGS_PAGE, authorHref } from "@/lib/authors/constants"
import { formatDay, linkHost } from "@/lib/authors/format"
import { playAuthor } from "@/lib/authors/playback"
import { shareAuthor } from "@/lib/authors/share"
import { say } from "@/lib/authors/text"
import type { AuthorProfilePublic, CollectionBrief, ReportReason } from "@/lib/authors/types"
import { useLanguage, useT } from "@/lib/i18n"
import { kindLabelPlural } from "@/lib/kirtan/kind"
import type { RemoteRecording } from "@/lib/kirtan/remote"
import { fromRemote } from "@/lib/kirtan/submissions"
import type { Kirtan, RecordingKind } from "@/lib/kirtan/types"
import { useAuthorStore } from "@/stores/authorStore"
import { href } from "@/utils/href"
import { photoSrc } from "@/components/authors/AuthorsUi"

type Tab = "recordings" | "playlists" | "about"
const REASONS: ReportReason[] = ["impersonation", "offensive", "spam", "copyright", "wrong_info", "other"]
const SAFE_LINK = /^https:\/\//i

/** Public author page: /author/<slug>. Recordings by kind, playlists from events, About; play all, share, report. */
export default function AuthorPage() {
  const params = useLocalSearchParams<{ slug?: string; v?: string }>()
  const slug = String(params.slug ?? "").toLowerCase()
  const router = useRouter()
  const t = useT()
  const theme = useSongsTheme()
  const top = useScreenTop()
  const bottom = useScrollBottomInset()
  const api = authorsApi()
  const { data, error, loading, reload } = useAuthorRequest(() => api.profile(slug), [slug], Boolean(slug))

  useEffect(() => {
    if (data?.kind === "moved") router.replace(href(authorHref(data.slug)))
  }, [data, router])

  const back = () => (router.canGoBack() ? router.back() : router.replace(href(AUTHORS_HREF)))
  const frame = (child: React.ReactNode) => (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: top }} />
      <View style={styles.backRow}>
        <PillButton theme={theme} tone="quiet" label={t("common.back")} onPress={back} />
      </View>
      {child}
    </View>
  )

  if (loading || data?.kind === "moved") return frame(<LoadingRows theme={theme} rows={5} />)
  if (error) return frame(<StateBlock theme={theme} tone="error" title={t("authors.page.errorTitle")} body={say(t, error)} action={t("common.tryAgain")} onAction={reload} />)
  if (!data || data.kind === "missing") return frame(<StateBlock theme={theme} title={t("authors.page.notFound.title")} body={t("authors.page.notFound.body")} action={t("authors.dir.title")} onAction={() => router.replace(href(AUTHORS_HREF))} />)
  if (data.kind === "gone") return frame(<StateBlock theme={theme} title={t("authors.page.gone.title")} body={t("authors.page.gone.body")} action={t("authors.dir.title")} onAction={() => router.replace(href(AUTHORS_HREF))} />)

  return <Page profile={data.profile} demo={api.demo} top={top} bottom={bottom} onBack={back} variant={api.demo ? Number(params.v) || 1 : 1} />
}

function Page({ profile, demo, top, bottom, onBack, variant }: { profile: AuthorProfilePublic; demo: boolean; top: number; bottom: number; onBack: () => void; variant: number }) {
  const t = useT()
  const locale = useLanguage()
  const theme = useSongsTheme()
  const api = authorsApi()
  const actions = useKirtanActions()
  const [tab, setTab] = useState<Tab>("recordings")
  const [kind, setKind] = useState<string | null>(null)
  const [items, setItems] = useState<RemoteRecording[]>([])
  const [total, setTotal] = useState(0)
  const [state, setState] = useState<"loading" | "ready" | "error" | "more">("loading")
  const [menu, setMenu] = useState<Kirtan | null>(null)
  const [share, setShare] = useState<Kirtan | null>(null)
  const [busy, setBusy] = useState(false)

  const slug = profile.slug
  const name = profile.display_name
  const router = useRouter()
  const signedIn = isSignedIn(api)
  const mineSlug = useAuthorStore((s) => s.mine?.slug ?? null)
  const loadMine = useAuthorStore((s) => s.load)
  const refreshMine = useAuthorStore((s) => s.refresh)
  useEffect(() => {
    if (signedIn && loadMine === "idle") void refreshMine()
  }, [signedIn, loadMine, refreshMine])
  const isOwn = mineSlug === slug
  const ownPill = isOwn ? (
    <KPress accessibilityRole="button" accessibilityLabel={t("authors.own.manage")} onPress={() => router.push(href(MY_AUTHOR_HREF))} pressedScale={0.96} style={[styles.ownPill, { borderColor: theme.accentText }]}>
      <Text style={[styles.ownText, { color: theme.accentText }]}>{t("authors.own.strip")}</Text>
    </KPress>
  ) : null

  const fetchPage = useCallback(
    async (offset: number) => {
      const page = await api.recordings(slug, { kind: kind ?? undefined, offset, limit: RECORDINGS_PAGE })
      return page
    },
    [api, slug, kind],
  )

  useEffect(() => {
    let live = true
    setState("loading")
    fetchPage(0).then(
      (page) => {
        if (!live) return
        setItems(page.items)
        setTotal(page.total)
        setState("ready")
      },
      () => live && setState("error"),
    )
    return () => {
      live = false
    }
  }, [fetchPage])

  const more = async () => {
    setState("more")
    try {
      const page = await fetchPage(items.length)
      setItems((old) => [...old, ...page.items])
      setTotal(page.total)
      setState("ready")
    } catch {
      setState("ready")
      actions.flash(t("authors.error.generic"))
    }
  }

  /** Everything that matches the current filter (up to 300), for Play all and Shuffle. */
  const everything = async (): Promise<RemoteRecording[]> => {
    let all = items
    while (all.length < total && all.length < 300) {
      const page = await fetchPage(all.length)
      if (!page.items.length) break
      all = [...all, ...page.items]
    }
    return all
  }
  const playAll = async (shuffle: boolean) => {
    setBusy(true)
    try {
      const all = await everything()
      const message = playAuthor({ slug, name }, all, { shuffle })
      if (message) actions.flash(message)
    } catch {
      actions.flash(t("authors.error.generic"))
    } finally {
      setBusy(false)
    }
  }

  const onShare = async () => {
    const outcome = await shareAuthor({ slug, name }, t("authors.share.intro", { name }))
    if (outcome === "copied") actions.flash(t("authors.share.copied"))
    if (outcome === "failed") actions.flash(t("authors.error.generic"))
  }

  const kirtans = useMemo(() => items.map((r) => fromRemote(r)), [items])
  const place = [profile.city, profile.country].filter(Boolean).join(", ")
  const meta = t("authors.count.recordings", { count: profile.recordings_count })
  const kinds = profile.kinds.filter((k) => k.count > 0)

  const openRecording = (r: Kirtan) => {
    const message = playAuthor({ slug, name }, items, { startId: r.serverId ?? null })
    if (message) actions.flash(message)
  }
  const shared: VariantProps = {
    theme,
    profile,
    demo,
    top,
    onBack,
    kirtans,
    total,
    state,
    kind,
    setKind,
    busy,
    onPlay: (shuffle) => void playAll(shuffle),
    onShare: () => void onShare(),
    onOpen: openRecording,
    onMenu: setMenu,
    onMore: () => void more(),
    own: ownPill,
    stats: profile.stats ? <PublicStatsStrip theme={theme} stats={profile.stats} demo={demo} /> : null,
    playlists: <Playlists slug={slug} name={name} flash={actions.flash} />,
    about: <About profile={profile} locale={locale} own={isOwn} signedIn={signedIn} />,
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: bottom + 24 }} showsVerticalScrollIndicator={false}>
        {variant === 2 ? <EditorialPage {...shared} /> : null}
        {variant === 3 ? <ShelvesPage {...shared} /> : null}
        {variant !== 2 && variant !== 3 ? <>
        <AuthorHero theme={theme} top={top} onBack={onBack} demo={demo} data={{ slug, name, type: profile.author_type, verified: profile.verified, place, photoUrl: profile.photo_url ? photoSrc(profile.photo_url) : null, meta }} />
        {ownPill ? <View style={styles.ownRow}>{ownPill}</View> : null}
        <View style={styles.actions}>
          <PillButton theme={theme} busy={busy} label={t("common.play")} icon={<PlayFilled size={18} color={theme.onBrand} />} onPress={() => void playAll(false)} disabled={!total} a11y={t("authors.page.playA11y", { name })} />
          <View style={styles.actionsRow}>
          <PillButton theme={theme} flex tone="line" disabled={!total || busy} label={t("common.shuffle")} icon={<Shuffle size={18} color={theme.textHeading} strokeWidth={2.2} />} onPress={() => void playAll(true)} />
          <PillButton theme={theme} flex tone="line" label={t("common.share")} onPress={() => void onShare()} a11y={t("authors.page.shareA11y", { name })} />
          </View>
        </View>
        <View style={styles.block}>
          <PublicStatsStrip theme={theme} stats={profile.stats} demo={demo} />
        </View>
        {demo ? <DemoNote theme={theme} /> : null}
        <View style={styles.tabs} accessibilityRole="tablist">
          <Chip theme={theme} label={t("authors.tab.recordings")} active={tab === "recordings"} onPress={() => setTab("recordings")} />
          <Chip theme={theme} label={t("authors.tab.playlists")} active={tab === "playlists"} onPress={() => setTab("playlists")} />
          <Chip theme={theme} label={t("authors.tab.about")} active={tab === "about"} onPress={() => setTab("about")} />
        </View>

        {tab === "recordings" ? (
          <View style={styles.block}>
            {kinds.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kindRow}>
                <Chip theme={theme} label={t("authors.page.allKinds")} active={kind === null} onPress={() => setKind(null)} count={profile.recordings_count} />
                {kinds.map((k) => (
                  <Chip key={k.kind} theme={theme} label={kindLabelPlural(k.kind as RecordingKind)} active={kind === k.kind} onPress={() => setKind(k.kind)} count={k.count} />
                ))}
              </ScrollView>
            ) : null}
            {state === "loading" ? <LoadingRows theme={theme} rows={4} /> : null}
            {state === "error" ? <StateBlock theme={theme} tone="error" title={t("authors.page.errorTitle")} body={t("authors.error.generic")} action={t("common.tryAgain")} onAction={() => setKind(kind)} /> : null}
            {state !== "loading" && state !== "error" && !items.length ? <StateBlock theme={theme} title={t("authors.page.empty")} /> : null}
            <View style={styles.rows}>
              {kirtans.map((k) => (
                <KirtanRow key={k.id} theme={theme} kirtan={k} compact onOpen={(r) => { const message = playAuthor({ slug, name }, items, { startId: r.serverId ?? null }); if (message) actions.flash(message) }} onMore={setMenu} />
              ))}
            </View>
            {items.length < total ? <PillButton theme={theme} tone="line" busy={state === "more"} label={t("authors.dir.more")} onPress={() => void more()} /> : null}
          </View>
        ) : null}

        {tab === "playlists" ? <Playlists slug={slug} name={name} flash={actions.flash} /> : null}

        {tab === "about" ? <About profile={profile} locale={locale} own={isOwn} signedIn={signedIn} /> : null}
        </> : null}
      </ScrollView>
      <KirtanMenuSheet open={Boolean(menu)} theme={theme} kirtan={menu} saved={false} onPlayNext={actions.playNext} onAddToPlaylist={actions.addToPlaylist} onToggleSave={actions.toggleSaved} onShare={(k) => setShare(k)} onClose={() => setMenu(null)} />
      <KirtanShareSheet open={Boolean(share)} theme={theme} kirtan={share} onShare={() => setShare(null)} onClose={() => setShare(null)} />
      <Toast message={actions.toast} theme={theme} />
    </View>
  )
}

function Playlists({ slug, name, flash }: { slug: string; name: string; flash: (m: string) => void }) {
  const t = useT()
  const locale = useLanguage()
  const theme = useSongsTheme()
  const api = authorsApi()
  const { data, error, loading, reload } = useAuthorRequest(() => api.collections(slug), [slug])
  const [open, setOpen] = useState<string | null>(null)
  const [tracks, setTracks] = useState<Record<string, RemoteRecording[]>>({})

  const load = async (c: CollectionBrief): Promise<RemoteRecording[]> => {
    const known = tracks[c.id]
    if (known) return known
    const page = await api.recordings(slug, { collectionId: c.id, limit: 100 })
    setTracks((old) => ({ ...old, [c.id]: page.items }))
    return page.items
  }
  const toggle = async (c: CollectionBrief) => {
    if (open === c.id) return setOpen(null)
    setOpen(c.id)
    try {
      await load(c)
    } catch {
      flash(t("authors.error.generic"))
    }
  }
  const play = async (c: CollectionBrief) => {
    try {
      const message = playAuthor({ slug, name }, await load(c))
      if (message) flash(message)
    } catch {
      flash(t("authors.error.generic"))
    }
  }

  if (loading) return <LoadingRows theme={theme} rows={2} />
  if (error) return <StateBlock theme={theme} tone="error" title={t("authors.page.errorTitle")} body={say(t, error)} action={t("common.tryAgain")} onAction={reload} />
  if (!data?.length) return <StateBlock theme={theme} title={t("authors.page.noPlaylists")} body={t("authors.page.noPlaylistsBody")} />
  return (
    <View style={styles.block}>
      {data.map((c) => {
        const expanded = open === c.id
        const list = tracks[c.id]
        return (
          <View key={c.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <KPress accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={c.title} onPress={() => void toggle(c)} pressedScale={0.98} style={styles.cardHead}>
              <View style={styles.flexText}>
                <Text style={[styles.cardTitle, { color: theme.textHeading }]}>{c.title}</Text>
                <Text style={[styles.cardMeta, { color: theme.textBody }]}>{[c.place, formatDay(c.starts_on, locale), t("authors.count.tracks", { count: c.tracks_count })].filter(Boolean).join(" · ")}</Text>
              </View>
            </KPress>
            <View style={styles.cardActions}>
              <PillButton theme={theme} tone="quiet" label={t("common.play")} onPress={() => void play(c)} />
            </View>
            {expanded ? (
              <View style={styles.rows}>
                {list ? list.map((r) => <KirtanRow key={r.id} theme={theme} kirtan={fromRemote(r)} compact onOpen={() => { const message = playAuthor({ slug, name }, list, { startId: r.id }); if (message) flash(message) }} />) : <LoadingRows theme={theme} rows={2} />}
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

function About({ profile, locale, own, signedIn }: { profile: AuthorProfilePublic; locale: string; own: boolean; signedIn: boolean }) {
  const t = useT()
  const theme = useSongsTheme()
  const router = useRouter()
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [comment, setComment] = useState("")
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [sending, setSending] = useState(false)
  const place = [profile.city, profile.country].filter(Boolean).join(", ")
  const empty = !profile.bio && !profile.about && !place && !profile.languages.length && !profile.links.length

  const send = async () => {
    if (!reason) return
    setSending(true)
    try {
      const outcome = await authorsApi().report(profile.slug, { reason, comment: comment.trim() || undefined })
      setResult({ ok: true, message: outcome.status === "already_reported" ? t("authors.report.already") : t("authors.report.thanks") })
      setReporting(false)
    } catch {
      setResult({ ok: false, message: t("authors.error.generic") })
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={styles.block}>
      {empty ? <StateBlock theme={theme} title={t("authors.page.aboutEmpty")} /> : null}
      {profile.bio ? <Text style={[styles.lead, { color: theme.textHeading }]}>{profile.bio}</Text> : null}
      {profile.about ? <Text style={[styles.body, { color: theme.textBody }]}>{profile.about}</Text> : null}
      {place ? <Fact theme={theme} label={t("authors.page.place")} value={place} /> : null}
      {profile.languages.length ? <Fact theme={theme} label={t("authors.page.languages")} value={profile.languages.map((l) => say(t, `authors.language.${l}`)).join(", ")} /> : null}
      {profile.published_at ? <Fact theme={theme} label={t("authors.page.since")} value={formatDay(profile.published_at, locale)} /> : null}
      {profile.links.length ? (
        <View style={styles.links}>
          <SectionTitle theme={theme}>{t("authors.page.links")}</SectionTitle>
          {profile.links
            .filter((l) => SAFE_LINK.test(l.url))
            .map((l) => (
              <KPress key={`${l.kind}-${l.url}`} accessibilityRole="link" accessibilityLabel={`${say(t, `authors.link.${l.kind}`)}, ${linkHost(l.url)}`} onPress={() => void Linking.openURL(l.url).catch(() => undefined)} pressedScale={0.98} style={[styles.linkRow, { backgroundColor: theme.card, borderColor: theme.line }]}>
                <Text style={[styles.linkKind, { color: theme.textHeading }]}>{say(t, `authors.link.${l.kind}`)}</Text>
                <Text style={[styles.linkHost, { color: theme.accentText }]} numberOfLines={1}>{linkHost(l.url)}</Text>
              </KPress>
            ))}
        </View>
      ) : null}

      <View style={styles.report}>
        {result ? <Text style={[styles.body, { color: result.ok ? theme.textBody : theme.dangerText }]} accessibilityLiveRegion="polite">{result.message}</Text> : null}
        {!own && !reporting && !result?.ok ? (
          <PillButton theme={theme} tone="quiet" label={signedIn ? t("authors.report.open") : t("authors.report.signin")} onPress={() => (signedIn ? (setReporting(true), setResult(null)) : router.push(href("/signin")))} />
        ) : null}
        {reporting ? (
          <View style={styles.reportForm}>
            <Text style={[styles.cardTitle, { color: theme.textHeading }]}>{t("authors.report.title")}</Text>
            <View style={styles.reasons}>
              {REASONS.map((r) => (
                <Chip key={r} theme={theme} label={say(t, `authors.report.reason.${r}`)} active={reason === r} onPress={() => setReason(r)} />
              ))}
            </View>
            <TextInput accessibilityLabel={t("authors.report.comment")} placeholder={t("authors.report.comment")} placeholderTextColor={theme.textMuted} value={comment} onChangeText={setComment} maxLength={1000} multiline style={[styles.comment, { backgroundColor: theme.card, borderColor: theme.line, color: theme.textHeading }]} />
            <View style={styles.actionsRow}>
              <PillButton theme={theme} flex tone="line" label={t("common.cancel")} onPress={() => setReporting(false)} />
              <PillButton theme={theme} flex busy={sending} disabled={!reason} label={t("authors.report.send")} onPress={() => void send()} />
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
}

function Fact({ theme, label, value }: { theme: ReturnType<typeof useSongsTheme>; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: theme.textHeading }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backRow: { paddingHorizontal: SIDE - 10, alignItems: "flex-start" },
  actions: { gap: 10, paddingHorizontal: SIDE, paddingTop: 18 },
  actionsRow: { flexDirection: "row", gap: 10 },
  block: { gap: 14, paddingHorizontal: SIDE, paddingTop: 16 },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: SIDE, paddingTop: 20 },
  kindRow: { gap: 8, paddingRight: SIDE },
  rows: { gap: 8 },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 6 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  flexText: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  cardMeta: { fontFamily: amFonts.regular, fontSize: 13, lineHeight: 18 },
  cardActions: { flexDirection: "row" },
  lead: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 27 },
  body: { fontFamily: amFonts.regular, fontSize: 16, lineHeight: 25 },
  fact: { gap: 2 },
  factLabel: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: "uppercase" },
  factValue: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22 },
  links: { gap: 8, marginHorizontal: -SIDE },
  linkRow: { marginHorizontal: SIDE, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1 },
  linkKind: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  linkHost: { flexShrink: 1, fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  report: { gap: 12, paddingTop: 12 },
  ownRow: { paddingHorizontal: SIDE, paddingTop: 14, alignItems: "flex-start" },
  ownPill: { minHeight: 36, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  ownText: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18 },
  reportForm: { gap: 12 },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  comment: { minHeight: 88, borderRadius: 16, borderWidth: 1, padding: 14, fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22, textAlignVertical: "top" },
})
