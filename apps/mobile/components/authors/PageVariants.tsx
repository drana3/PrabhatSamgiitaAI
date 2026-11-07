import type { ReactNode } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { Shuffle } from "lucide-react-native"

import { AuthorAvatar, Chip, DemoBadge, LoadingRows, PillButton, SIDE, StateBlock } from "@/components/authors/AuthorsUi"
import { artistGradient } from "@/components/kirtan/ArtistParts"
import { KirtanRow, PlayFilled } from "@/components/kirtan/KirtanParts"
import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AuthorProfilePublic } from "@/lib/authors/types"
import { useT } from "@/lib/i18n"
import { kindLabel, kindLabelPlural } from "@/lib/kirtan/kind"
import { formatKirtanLength } from "@/lib/kirtan/list"
import type { Kirtan, RecordingKind } from "@/lib/kirtan/types"

/**
 * Two other ways to lay out the public author page, to choose from (preview only: `?v=2` and `?v=3` on /author/<slug>;
 * the first one is the page in app/author/[slug].tsx). They share the data and the blocks (playlists, About, the report)
 * and differ in how the page is built. See docs/author-profiles.md, "Page layouts".
 */
export type VariantProps = {
  theme: SongsTheme
  profile: AuthorProfilePublic
  demo: boolean
  top: number
  onBack: () => void
  kirtans: Kirtan[]
  total: number
  state: "loading" | "ready" | "error" | "more"
  kind: string | null
  setKind: (kind: string | null) => void
  busy: boolean
  onPlay: (shuffle: boolean) => void
  onShare: () => void
  onOpen: (kirtan: Kirtan) => void
  onMenu: (kirtan: Kirtan) => void
  onMore: () => void
  /** "This is your page" pill, or null when it is not the viewer's own page */
  own: ReactNode
  /** the blocks both layouts share */
  stats: ReactNode
  playlists: ReactNode
  about: ReactNode
}

function Back({ theme, top, onBack, right }: { theme: SongsTheme; top: number; onBack: () => void; right?: ReactNode }) {
  const t = useT()
  return (
    <View style={{ paddingTop: top, paddingHorizontal: SIDE - 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <PillButton theme={theme} tone="quiet" label={t("common.back")} onPress={onBack} />
      {right}
    </View>
  )
}

function KindChips({ props }: { props: VariantProps }) {
  const t = useT()
  const { theme, profile, kind, setKind } = props
  const kinds = profile.kinds.filter((k) => k.count > 0)
  if (kinds.length < 2) return null
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      <Chip theme={theme} label={t("authors.page.allKinds")} active={kind === null} onPress={() => setKind(null)} count={profile.recordings_count} />
      {kinds.map((k) => (
        <Chip key={k.kind} theme={theme} label={kindLabelPlural(k.kind as RecordingKind)} active={kind === k.kind} onPress={() => setKind(k.kind)} count={k.count} />
      ))}
    </ScrollView>
  )
}

function Status({ props }: { props: VariantProps }) {
  const t = useT()
  const { theme, state, kirtans, kind, setKind } = props
  if (state === "loading") return <LoadingRows theme={theme} rows={4} />
  if (state === "error") return <StateBlock theme={theme} tone="error" title={t("authors.page.errorTitle")} body={t("authors.error.generic")} action={t("common.tryAgain")} onAction={() => setKind(kind)} />
  if (!kirtans.length) return <StateBlock theme={theme} title={t("authors.page.empty")} />
  return null
}

/* ------------------------------------------------------------------ 2: the discography (type, no picture, one index) */

/**
 * "Дискография": no gradient and no tabs. The name is set large on the paper, the bio is the lead, and every recording is
 * a numbered line of one index, like the back of a record sleeve. Playlists, About and links follow in the same scroll.
 */
export function EditorialPage(props: VariantProps) {
  const t = useT()
  const { theme, profile, demo, top, onBack, kirtans, total, state, busy, onPlay, onShare, onOpen, onMore, stats, playlists, about } = props
  const place = [profile.city, profile.country].filter(Boolean).join(", ")
  const type = t(profile.author_type === "group" ? "authors.type.group" : "authors.type.solo")
  const numbers = profile.stats?.enough_data
    ? [
        profile.stats.monthly_listeners != null ? t("authors.count.listeners", { count: profile.stats.monthly_listeners }) : null,
        profile.stats.total_plays != null ? t("authors.count.plays", { count: profile.stats.total_plays }) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : ""
  return (
    <View style={{ paddingBottom: 24 }}>
      <Back theme={theme} top={top} onBack={onBack} right={props.own} />
      <View style={styles.editHead}>
        <View style={styles.editEyebrowRow}>
          <Text style={[styles.eyebrow, { color: theme.accentText }]}>{[type, profile.verified ? t("authors.verified") : null, place || null].filter(Boolean).join(" · ")}</Text>
          {demo ? <DemoBadge theme={theme} /> : null}
        </View>
        <Text style={[styles.editName, { color: theme.textHeading }]} accessibilityRole="header" numberOfLines={4} adjustsFontSizeToFit minimumFontScale={0.5}>
          {profile.display_name}
        </Text>
        {profile.bio ? <Text style={[styles.lead, { color: theme.textHeading }]}>{profile.bio}</Text> : null}
        <View style={[styles.rule, { backgroundColor: theme.textHeading }]} />
        {numbers ? <Text style={[styles.numbers, { color: theme.textBody }]}>{numbers}</Text> : <Text style={[styles.numbers, { color: theme.textMuted }]}>{t("authors.count.recordings", { count: profile.recordings_count })}</Text>}
        <View style={styles.editActions}>
          <View style={styles.grow}>
            <PillButton theme={theme} busy={busy} disabled={!total} label={t("common.play")} icon={<PlayFilled size={18} color={theme.onBrand} />} onPress={() => onPlay(false)} a11y={t("authors.page.playA11y", { name: profile.display_name })} />
          </View>
          <PillButton theme={theme} tone="line" disabled={!total || busy} label={t("common.shuffle")} icon={<Shuffle size={18} color={theme.textHeading} strokeWidth={2.2} />} onPress={() => onPlay(true)} />
          <PillButton theme={theme} tone="line" label={t("common.share")} onPress={onShare} a11y={t("authors.page.shareA11y", { name: profile.display_name })} />
        </View>
      </View>

      <View style={styles.indexHead}>
        <Text style={[styles.indexTitle, { color: theme.textHeading }]} accessibilityRole="header">
          {t("authors.tab.recordings")}
        </Text>
        <Text style={[styles.indexCount, { color: theme.textMuted }]}>{total || profile.recordings_count}</Text>
      </View>
      <KindChips props={props} />
      <View style={styles.pad}>
        <Status props={props} />
        {kirtans.map((k, i) => (
          <KPress key={k.id} accessibilityRole="button" accessibilityLabel={k.title} onPress={() => onOpen(k)} pressedScale={0.99} style={[styles.indexRow, { borderTopColor: theme.line }]}>
            <Text style={[styles.indexNo, { color: theme.textMuted }]}>{String(i + 1).padStart(2, "0")}</Text>
            <View style={styles.grow}>
              <Text style={[styles.indexName, { color: theme.textHeading }]} numberOfLines={2}>
                {k.title}
              </Text>
              <Text style={[styles.indexMeta, { color: theme.textBody }]} numberOfLines={1}>
                {[kindLabel(k.kind), k.plays != null ? t("authors.count.plays", { count: k.plays }) : null].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <Text style={[styles.indexTime, { color: theme.textBody }]}>{k.durationSec ? formatKirtanLength(k.durationSec) : ""}</Text>
          </KPress>
        ))}
        {kirtans.length < total ? <PillButton theme={theme} tone="line" busy={state === "more"} label={t("authors.dir.more")} onPress={onMore} /> : null}
      </View>

      <View style={styles.indexHead}>
        <Text style={[styles.indexTitle, { color: theme.textHeading }]} accessibilityRole="header">
          {t("authors.tab.playlists")}
        </Text>
      </View>
      {playlists}

      <View style={styles.indexHead}>
        <Text style={[styles.indexTitle, { color: theme.textHeading }]} accessibilityRole="header">
          {t("authors.tab.about")}
        </Text>
      </View>
      {about}
      {stats ? <View style={{ paddingTop: 24 }}>{stats}</View> : null}
    </View>
  )
}

/* ------------------------------------------------------------------ 3: the shelves (person first, rows that scroll sideways) */

/**
 * "Витрина": a small header with the person, one wide Play button, then shelves: the most played recordings as covers that
 * scroll sideways, the playlists from events, and the rest grouped by kind. About is last and folded away by length.
 */
export function ShelvesPage(props: VariantProps) {
  const t = useT()
  const { theme, profile, demo, top, onBack, kirtans, total, state, busy, onPlay, onShare, onOpen, onMenu, onMore, stats, playlists, about } = props
  const place = [profile.city, profile.country].filter(Boolean).join(", ")
  const popular = [...kirtans].sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0)).slice(0, 6)
  const groups = (props.kind ? [props.kind] : profile.kinds.filter((k) => k.count > 0).map((k) => k.kind)).map((k) => ({ kind: k, rows: kirtans.filter((x) => x.kind === k) })).filter((g) => g.rows.length)
  const [from, to] = artistGradient(profile.slug)
  return (
    <View style={{ paddingBottom: 24 }}>
      <Back theme={theme} top={top} onBack={onBack} right={props.own} />
      <View style={styles.shelfHead}>
        <AuthorAvatar slug={profile.slug} name={profile.display_name} photoUrl={profile.photo_url} size={76} />
        <View style={styles.grow}>
          <Text style={[styles.shelfName, { color: theme.textHeading }]} accessibilityRole="header" numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.6}>
            {profile.display_name}
          </Text>
          <Text style={[styles.indexMeta, { color: theme.textBody }]} numberOfLines={2}>
            {[t(profile.author_type === "group" ? "authors.type.group" : "authors.type.solo"), profile.verified ? t("authors.verified") : null, place || null].filter(Boolean).join(" · ")}
          </Text>
          {demo ? <DemoBadge theme={theme} /> : null}
        </View>
      </View>
      {profile.bio ? (
        <Text style={[styles.shelfBio, { color: theme.textBody }]} numberOfLines={3}>
          {profile.bio}
        </Text>
      ) : null}
      <View style={styles.pad}>
        <PillButton theme={theme} busy={busy} disabled={!total} label={`${t("common.play")} · ${t("authors.count.recordings", { count: profile.recordings_count })}`} icon={<PlayFilled size={18} color={theme.onBrand} />} onPress={() => onPlay(false)} a11y={t("authors.page.playA11y", { name: profile.display_name })} />
        <View style={styles.row}>
          <PillButton theme={theme} flex tone="line" disabled={!total || busy} label={t("common.shuffle")} icon={<Shuffle size={18} color={theme.textHeading} strokeWidth={2.2} />} onPress={() => onPlay(true)} />
          <PillButton theme={theme} flex tone="line" label={t("common.share")} onPress={onShare} a11y={t("authors.page.shareA11y", { name: profile.display_name })} />
        </View>
      </View>
      {stats ? <View style={{ paddingTop: 16 }}>{stats}</View> : null}

      {popular.length > 1 ? (
        <>
          <Text style={[styles.shelfTitle, { color: theme.textHeading }]} accessibilityRole="header">
            {t("authors.stats.top")}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
            {popular.map((k) => (
              <KPress key={k.id} accessibilityRole="button" accessibilityLabel={k.title} onPress={() => onOpen(k)} pressedScale={0.96} style={styles.cover}>
                <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <LinearGradient pointerEvents="none" colors={["rgba(10,14,8,0)", "rgba(10,14,8,0.7)"]} style={StyleSheet.absoluteFill} />
                <Text style={styles.coverKind}>{kindLabel(k.kind).toUpperCase()}</Text>
                <Text style={styles.coverTitle} numberOfLines={3}>
                  {k.title}
                </Text>
                {k.plays != null ? <Text style={styles.coverPlays}>{t("authors.count.plays", { count: k.plays })}</Text> : null}
              </KPress>
            ))}
          </ScrollView>
        </>
      ) : null}

      <Text style={[styles.shelfTitle, { color: theme.textHeading }]} accessibilityRole="header">
        {t("authors.tab.playlists")}
      </Text>
      {playlists}

      <Text style={[styles.shelfTitle, { color: theme.textHeading }]} accessibilityRole="header">
        {t("authors.tab.recordings")}
      </Text>
      <KindChips props={props} />
      <View style={styles.pad}>
        <Status props={props} />
        {groups.map((g) => (
          <View key={g.kind} style={styles.group}>
            <Text style={[styles.groupTitle, { color: theme.textMuted }]}>{`${kindLabelPlural(g.kind as RecordingKind)} · ${g.rows.length}`}</Text>
            {g.rows.map((k) => (
              <KirtanRow key={k.id} theme={theme} kirtan={k} compact onOpen={onOpen} onMore={onMenu} />
            ))}
          </View>
        ))}
        {kirtans.length < total ? <PillButton theme={theme} tone="line" busy={state === "more"} label={t("authors.dir.more")} onPress={onMore} /> : null}
      </View>

      <Text style={[styles.shelfTitle, { color: theme.textHeading }]} accessibilityRole="header">
        {t("authors.tab.about")}
      </Text>
      {about}
    </View>
  )
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: SIDE, gap: 10 },
  grow: { flex: 1, gap: 2 },
  row: { flexDirection: "row", gap: 10 },
  chips: { gap: 8, paddingHorizontal: SIDE, paddingBottom: 12 },
  eyebrow: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase", flexShrink: 1 },
  /* discography */
  editHead: { paddingHorizontal: SIDE, paddingTop: 20, gap: 14 },
  editEyebrowRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  editName: { fontFamily: amFonts.display, fontSize: 64, lineHeight: 62, letterSpacing: -2, textTransform: "uppercase" },
  lead: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 27 },
  rule: { height: 2, marginTop: 2 },
  numbers: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  editActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  indexHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: SIDE, paddingTop: 32, paddingBottom: 12 },
  indexTitle: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 30, letterSpacing: -0.5, textTransform: "uppercase" },
  indexCount: { fontFamily: amFonts.bold, fontSize: 28, lineHeight: 30 },
  indexRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  indexNo: { width: 26, fontFamily: amFonts.bold, fontSize: 14, lineHeight: 20 },
  indexName: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 21 },
  indexMeta: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  indexTime: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  /* shelves */
  shelfHead: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: SIDE, paddingTop: 12 },
  shelfName: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 32, letterSpacing: -0.6, textTransform: "uppercase" },
  shelfBio: { paddingHorizontal: SIDE, paddingTop: 12, paddingBottom: 16, fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
  shelfTitle: { paddingHorizontal: SIDE, paddingTop: 30, paddingBottom: 12, fontFamily: amFonts.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.3, textTransform: "uppercase" },
  cards: { gap: 10, paddingHorizontal: SIDE },
  cover: { width: 156, height: 156, borderRadius: 20, overflow: "hidden", padding: 14, justifyContent: "flex-end", gap: 2 },
  coverKind: { fontFamily: amFonts.semi, fontSize: 10.5, lineHeight: 14, letterSpacing: 1, color: "rgba(255,255,255,0.85)" },
  coverTitle: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 20, color: "#FFFFFF" },
  coverPlays: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16, color: "rgba(255,255,255,0.85)" },
  group: { gap: 8, paddingTop: 6 },
  groupTitle: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: "uppercase", paddingTop: 6 },
})
