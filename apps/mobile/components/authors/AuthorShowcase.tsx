import type { ReactNode } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { Shuffle } from "lucide-react-native"

import { AuthorAvatar, Chip, DemoBadge, LoadingRows, PillButton, SIDE, StateBlock } from "@/components/authors/AuthorsUi"
import { Section, BlockStack } from "@/components/common/Layout"
import { artistGradient } from "@/components/kirtan/ArtistParts"
import { KirtanRow, PlayFilled } from "@/components/kirtan/KirtanParts"
import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AuthorProfilePublic } from "@/lib/authors/types"
import { useT } from "@/lib/i18n"
import { kindLabel, kindLabelPlural } from "@/lib/kirtan/kind"
import type { Kirtan, RecordingKind } from "@/lib/kirtan/types"

/**
 * The public author page, "Showcase": a small header with the person, one wide Play button, then shelves (most played as
 * covers that scroll sideways, playlists from events, recordings by kind, About). See docs/author-profiles.md, "Page".
 */
export type ShowcaseProps = {
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

function KindChips({ props }: { props: ShowcaseProps }) {
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

function Status({ props }: { props: ShowcaseProps }) {
  const t = useT()
  const { theme, state, kirtans, kind, setKind } = props
  if (state === "loading") return <LoadingRows theme={theme} rows={4} />
  if (state === "error") return <StateBlock theme={theme} tone="error" title={t("authors.page.errorTitle")} body={t("authors.error.generic")} action={t("common.tryAgain")} onAction={() => setKind(kind)} />
  if (!kirtans.length) return <StateBlock theme={theme} title={t("authors.page.empty")} />
  return null
}

/**
 * "Витрина": a small header with the person, one wide Play button, then shelves: the most played recordings as covers that
 * scroll sideways, the playlists from events, and the rest grouped by kind. About is last and folded away by length.
 */
export function ShowcasePage(props: ShowcaseProps) {
  const t = useT()
  const { theme, profile, demo, top, onBack, kirtans, total, state, busy, onPlay, onShare, onOpen, onMenu, onMore, stats, playlists, about } = props
  const place = [profile.city, profile.country].filter(Boolean).join(", ")
  // With the listening statistics switched off the page shows no ranking and no counts at all, so no "Most played" shelf.
  const popular = !profile.stats ? [] : [...kirtans].sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0)).slice(0, 6)
  const groups = (props.kind ? [props.kind] : profile.kinds.filter((k) => k.count > 0).map((k) => k.kind)).map((k) => ({ kind: k, rows: kirtans.filter((x) => x.kind === k) })).filter((g) => g.rows.length)
  const [from, to] = artistGradient(profile.slug)
  return (
    <View style={styles.page}>
      <Back theme={theme} top={top} onBack={onBack} right={props.own} />
      {/* the header: the person, a word about them, the buttons. Each group is a BlockStack, so no block can touch the next one. */}
      <BlockStack gap={24} side={SIDE} style={styles.header}>
        <BlockStack gap={12}>
          <View style={styles.shelfHead}>
            <AuthorAvatar slug={profile.slug} name={profile.display_name} photoUrl={profile.photo_url} size={76} />
            <View style={styles.grow}>
              <Text style={[styles.shelfName, { color: theme.textHeading }]} accessibilityRole="header" numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.6}>
                {profile.display_name}
              </Text>
              <Text style={[styles.indexMeta, { color: theme.textBody }]} numberOfLines={2}>
                {[t(profile.author_type === "group" ? "authors.type.group" : "authors.type.solo"), profile.verified ? t("authors.verified") : null, place || null].filter(Boolean).join(" · ")}
              </Text>
              {demo ? (
                <View style={styles.badge}>
                  <DemoBadge theme={theme} />
                </View>
              ) : null}
            </View>
          </View>
          {profile.bio ? (
            <Text style={[styles.shelfBio, { color: theme.textBody }]} numberOfLines={3}>
              {profile.bio}
            </Text>
          ) : null}
        </BlockStack>
        <BlockStack gap={12}>
          <PillButton theme={theme} busy={busy} disabled={!total} label={`${t("common.play")} · ${t("authors.count.recordings", { count: profile.recordings_count })}`} icon={<PlayFilled size={18} color={theme.onBrand} />} onPress={() => onPlay(false)} a11y={t("authors.page.playA11y", { name: profile.display_name })} />
          <BlockStack row gap={12}>
            <PillButton theme={theme} flex tone="line" disabled={!total || busy} label={t("common.shuffle")} icon={<Shuffle size={18} color={theme.textHeading} strokeWidth={2.2} />} onPress={() => onPlay(true)} />
            <PillButton theme={theme} flex tone="line" label={t("common.share")} onPress={onShare} a11y={t("authors.page.shareA11y", { name: profile.display_name })} />
          </BlockStack>
        </BlockStack>
      </BlockStack>
      {stats ? <View style={styles.stats}>{stats}</View> : null}

      {popular.length > 1 ? (
        <Section title={t("authors.stats.top")} bleed>
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
        </Section>
      ) : null}

      <Section title={t("authors.tab.playlists")} bleed>
        {playlists}
      </Section>

      <Section title={t("authors.tab.recordings")} bleed>
        <KindChips props={props} />
        <BlockStack gap={16} side={SIDE}>
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
        </BlockStack>
      </Section>

      <Section title={t("authors.tab.about")} bleed>
        {about}
      </Section>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { paddingBottom: 24 },
  header: { paddingTop: 12 },
  stats: { paddingTop: 24 },
  grow: { flex: 1, gap: 4 },
  badge: { paddingTop: 4 },
  chips: { gap: 8, paddingHorizontal: SIDE },
  indexMeta: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  /* shelves */
  shelfHead: { flexDirection: "row", alignItems: "center", gap: 16 },
  shelfName: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 32, letterSpacing: -0.6, textTransform: "uppercase" },
  shelfBio: { fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
  cards: { gap: 12, paddingHorizontal: SIDE },
  cover: { width: 156, height: 156, borderRadius: 20, overflow: "hidden", padding: 14, justifyContent: "flex-end", gap: 4 },
  coverKind: { fontFamily: amFonts.semi, fontSize: 10.5, lineHeight: 14, letterSpacing: 1, color: "rgba(255,255,255,0.85)" },
  coverTitle: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 20, color: "#FFFFFF" },
  coverPlays: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16, color: "rgba(255,255,255,0.85)" },
  group: { gap: 8 },
  groupTitle: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: "uppercase" },
})
