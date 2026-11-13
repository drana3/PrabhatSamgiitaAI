import { type ReactNode } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { PhotoTileGrid } from "@/components/search-v2/BrowseTiles"
import { HOME_INSET } from "@/components/home/HomeBlocks"
import { SpRound } from "@/components/song-v2/SpUi"
import { ChevronRightGlyph } from "@/components/songs-v2/Glyphs"
import { Press } from "@/components/songs-v2/Press"
import { Reveal } from "@/components/today/motion"
import { overStyle } from "@/components/today/TodayBlocks"
import { TodayPress } from "@/components/today/TodayPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSearchCardsData } from "@/hooks/useSearchCardsData"
import { useSearchMenu } from "@/hooks/useSearchMenu"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSpTheme } from "@/hooks/useSpTheme"
import { useT } from "@/lib/i18n"
import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"
import { festivalsEmpty, type BrowseTile, type FestivalRow } from "@/lib/searchCards/browse"
import { shelfCountLabel } from "@/lib/searchMenu/live"
import { href } from "@/utils/href"

const SECTIONS = ["mood", "type", "festivals"] as const
type Section = (typeof SECTIONS)[number]

function parseSection(value: string | string[] | undefined): Section {
  const raw = Array.isArray(value) ? value[0] : value
  return SECTIONS.find((id) => id === raw) ?? "mood"
}

/**
 * The page behind a Search card (Dada, 10 Nov 2026): `/search-browse?section=mood|type|festivals`.
 * Mood: photo tiles of the moods; a tile opens the songs of that mood. Kiirtan type: photo tiles of the types that have
 * recordings; a tile opens them. Festivals: what is coming, the festival song lists and the event sets, as rows.
 * (Collections and Authors open the pages the app already has.) A section with nothing in it says so in plain words and
 * links on; it is never a blank page.
 */
export default function SearchBrowseScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const sp = useSpTheme()
  const inset = useScreenTop()
  const bottomInset = useScrollBottomInset()
  const params = useLocalSearchParams<{ section?: string; menu?: string }>()
  const section = parseSection(params.section)
  const menu = useSearchMenu(params.menu)
  const data = useSearchCardsData(menu)

  const back = () => (router.canGoBack() ? router.back() : router.replace(href(NAV_V2_HOME_ROUTE)))
  const open = (tile: BrowseTile) => router.push(href(tile.href))
  const browseCollections = () => router.push(href("/collections-v2"))

  const title = t(`searchCards.card.${section}` as const)
  const lead = t(`searchCards.page.${section}.lead` as const)

  let body: ReactNode
  if (section === "mood") {
    const { songs, kiirtan } = data.moods
    body =
      songs.length + kiirtan.length === 0 ? (
        <Empty theme={theme} text={t("searchCards.empty.mood")} action={t("search.none.browse")} onAction={browseCollections} />
      ) : (
        <View style={s.groups}>
          {songs.length ? (
            <Group theme={theme} title={t("searchCards.page.mood.songs")}>
              <PhotoTileGrid tiles={songs} onOpen={open} />
            </Group>
          ) : null}
          {kiirtan.length ? (
            <Group theme={theme} title={t("searchCards.page.mood.kiirtan")} note={t("searchCards.page.mood.kiirtan.note")}>
              <PhotoTileGrid tiles={kiirtan} onOpen={open} firstIndex={songs.length} />
            </Group>
          ) : null}
        </View>
      )
  } else if (section === "type") {
    body = data.types.length ? (
      <PhotoTileGrid tiles={data.types} onOpen={open} />
    ) : (
      <Empty theme={theme} text={t("searchCards.empty.type")} action={t("searchCards.empty.upload")} onAction={() => router.push(href("/upload"))} />
    )
  } else {
    const { coming, songs, sets } = data.festivals
    body = festivalsEmpty(data.festivals) ? (
      <Empty theme={theme} text={t("searchCards.empty.festivals")} action={t("search.none.browse")} onAction={browseCollections} />
    ) : (
      <View style={s.groups}>
        {coming.length ? (
          <Group theme={theme} title={t("searchCards.page.festivals.coming")}>
            <Rows theme={theme} rows={coming} onOpen={(row) => router.push(href(row.href))} />
          </Group>
        ) : null}
        {songs.length ? (
          <Group theme={theme} title={t("searchCards.page.festivals.songs")}>
            <Rows theme={theme} rows={songs} onOpen={(row) => router.push(href(row.href))} />
          </Group>
        ) : null}
        {sets ? (
          <Group theme={theme} title={t("searchCards.page.festivals.sets")}>
            <Rows
              theme={theme}
              rows={[{ key: "sets", title: t("searchMenu.kiirtan.sets"), line: `${t("searchCards.page.festivals.sets.count")} · ${shelfCountLabel(sets.count)}`, href: sets.href }]}
              onOpen={(row) => router.push(href(row.href))}
            />
          </Group>
        ) : null}
      </View>
    )
  }

  return (
    <View style={[s.root, { backgroundColor: theme.page }]} testID={`search-browse-${section}`}>
      <View style={[s.bar, { paddingTop: inset, backgroundColor: theme.page }]}>
        <View style={s.titleRow}>
          <SpRound t={sp} icon="back" label={t("common.back")} onPress={back} />
          <Text style={[s.title, { color: theme.textHeading }]} numberOfLines={2} accessibilityRole="header">
            {title}
          </Text>
        </View>
        <Text style={[s.lead, { color: theme.textBody }]}>{lead}</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 16, paddingBottom: bottomInset }}>
        {body}
      </ScrollView>
    </View>
  )
}

function Group({ theme, title, note, children }: { theme: SongsTheme; title: string; note?: string; children: ReactNode }) {
  return (
    <View style={s.group}>
      <View style={s.groupHead}>
        <Text style={[overStyle, { color: theme.eyebrow }]} accessibilityRole="header">
          {title}
        </Text>
        {note ? <Text style={[s.note, { color: theme.textBody }]}>{note}</Text> : null}
      </View>
      {children}
    </View>
  )
}

function Rows({ theme, rows, onOpen }: { theme: SongsTheme; rows: readonly FestivalRow[]; onOpen: (row: FestivalRow) => void }) {
  return (
    <View style={s.rows}>
      {rows.map((row, index) => (
        <Reveal key={row.key} index={Math.min(index, 8)}>
          <Press
            accessibilityRole="button"
            accessibilityLabel={`${row.title}, ${row.line}`}
            onPress={() => onOpen(row)}
            pressedScale={0.98}
            style={[s.row, { backgroundColor: theme.card, borderColor: theme.line }]}
            testID={`browse-row-${row.key}`}
          >
            <View style={s.rowText}>
              <Text style={[s.rowTitle, { color: theme.textHeading }]} numberOfLines={2}>
                {row.title}
              </Text>
              <Text style={[s.rowLine, { color: theme.textBody }]} numberOfLines={2}>
                {row.line}
              </Text>
            </View>
            <ChevronRightGlyph color={theme.textBody} />
          </Press>
        </Reveal>
      ))}
    </View>
  )
}

/** An honest empty page: one sentence of what is missing and when it fills, and a way on. */
function Empty({ theme, text, action, onAction }: { theme: SongsTheme; text: string; action: string; onAction: () => void }) {
  return (
    <View style={s.empty} accessibilityLiveRegion="polite" testID="search-browse-empty">
      <Text style={[s.emptyText, { color: theme.textBody }]}>{text}</Text>
      <TodayPress accessibilityRole="button" accessibilityLabel={action} onPress={onAction} pressedScale={0.95} style={[s.emptyButton, { backgroundColor: theme.brand }]}>
        <Text style={[s.emptyButtonText, { color: theme.onBrand }]}>{action}</Text>
      </TodayPress>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bar: { zIndex: 5, paddingBottom: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 10, paddingRight: 16, minHeight: 56 },
  title: { flex: 1, fontFamily: amFonts.display, fontSize: 28, lineHeight: 31, letterSpacing: -0.56, textTransform: "uppercase" },
  lead: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingHorizontal: HOME_INSET, paddingTop: 4 },
  groups: { gap: 32 },
  group: { gap: 12 },
  groupHead: { paddingHorizontal: HOME_INSET, gap: 4 },
  note: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  rows: { gap: 10, paddingHorizontal: HOME_INSET },
  row: { minHeight: 76, borderRadius: 20, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingLeft: 20, paddingRight: 16 },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 18, lineHeight: 22 },
  rowLine: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  empty: { gap: 20, paddingHorizontal: HOME_INSET, paddingTop: 24, alignItems: "flex-start" },
  emptyText: { fontFamily: amFonts.medium, fontSize: 17, lineHeight: 24, maxWidth: 340 },
  emptyButton: { height: 48, paddingHorizontal: 24, borderRadius: 70, justifyContent: "center" },
  emptyButtonText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
})
