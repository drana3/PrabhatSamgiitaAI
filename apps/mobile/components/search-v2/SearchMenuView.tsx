import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { HOME_INSET } from "@/components/home/HomeBlocks"
import { DiscoverShelf, RecentPlaysShelf, RecentRow, TileGrid } from "@/components/search-v2/BrowseBlocks"
import { AgainStrip, BlockTitle, ItemShelf, MoodChips, SubTitle } from "@/components/search-v2/MenuShelves"
import { SearchByBlock } from "@/components/search-v2/SearchByBlock"
import { overStyle } from "@/components/today/TodayBlocks"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import type { AmProto } from "@/constants/tokens/amToday"
import { amFonts } from "@/constants/tokens/amTypography"
import type { BrowseTile, DiscoverTag } from "@/lib/fixtures/home"
import { useT, t as translate } from "@/lib/i18n"
import type { HistoryEntry } from "@/lib/listening/history"
import { kindLabelPlural } from "@/lib/kirtan/kind"
import { realCollectionEntries, type KindTile } from "@/lib/searchBrowse"
import { collectionHref } from "@/lib/songsV2/collectionsIndex"
import { MENU_RULES } from "@/lib/searchMenu/config"
import { titleCase } from "@/lib/searchMenu/facets"
import { shelfHref, shelfItems, shelfTitle, type MenuKirtan } from "@/lib/searchMenu/live"
import { buildSearchBy } from "@/lib/searchMenu/searchBy"
import type { MenuBlock, MenuShelf } from "@/lib/searchMenu/types"
import type { SearchMenu } from "@/hooks/useSearchMenu"
import type { RecentPlay } from "@/stores/preferencesStore"

type P = { p: AmProto }

const BLOCK_TITLE: Partial<Record<MenuBlock, "searchMenu.block.ps" | "searchMenu.block.kiirtan" | "searchMenu.block.bhajans" | "searchMenu.block.others">> = {
  ps: "searchMenu.block.ps",
  kiirtan: "searchMenu.block.kiirtan",
  bhajans: "searchMenu.block.bhajans",
  others: "searchMenu.block.others",
}

/** How many cards a shelf shows before "See all". */
function shown(shelf: MenuShelf): number {
  if (shelf.id === "new") return MENU_RULES.newMonth.show
  if (shelf.id === "mostPlayed") return MENU_RULES.mostPlayed.show
  return 12
}

/**
 * The empty-field view of Search with the adaptive menu (docs/search-menu.md): variant D on top of A. Top: recent searches,
 * the four section tiles, "Listen again" from this phone's own history. Then the shelves the rules chose, block by block:
 * Baba's voice, Prabhat Samgiita (collections and performances), Kiirtan (types, styles, events), authors, spiritual songs,
 * Bhajans by language, moods. Every shelf shows its real count and opens its full list with "See all".
 */
export function SearchMenuView({
  p,
  theme,
  menu,
  top,
  discover,
  kindTiles,
  recents,
  played,
  history,
  onTile,
  onTag,
  onRecent,
  onClearRecents,
  onPlayed,
  onOpen,
  onSeeAll,
  onPlayEntry,
  onHistory,
}: P & {
  theme: SongsTheme
  menu: SearchMenu
  top: readonly BrowseTile[]
  discover: readonly DiscoverTag[]
  kindTiles: readonly KindTile[]
  recents: readonly string[]
  played: readonly RecentPlay[]
  history: readonly HistoryEntry[]
  onTile: (tile: BrowseTile) => void
  onTag: (tag: DiscoverTag) => void
  onRecent: (q: string) => void
  onClearRecents: () => void
  onPlayed: (play: RecentPlay) => void
  onOpen: (k: MenuKirtan, list: readonly MenuKirtan[], label: string) => void
  onSeeAll: (href: string) => void
  onPlayEntry: (e: HistoryEntry) => void
  onHistory: () => void
}) {
  const t = useT()
  const { result, stats, kirtans, now, stage } = menu

  const blocks = useMemo(() => {
    const order: MenuBlock[] = []
    for (const shelf of result.shelves) if (!order.includes(shelf.block)) order.push(shelf.block)
    return order.map((block) => ({ block, shelves: result.shelves.filter((sh) => sh.block === block) }))
    // the titles follow the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.shelves, t])

  const itemShelf = (shelf: MenuShelf, eyebrow?: string) => {
    const all = shelfItems(shelf.id, kirtans, stats, now)
    if (!all.length) return null
    const title = shelfTitle(shelf)
    const note = shelf.id === "mostPlayed" ? translate(shelf.source === "lifetime" ? "searchMenu.mostPlayed.lifetime" : "searchMenu.mostPlayed.window") : undefined
    return (
      <ItemShelf
        key={shelf.id}
        p={p}
        theme={theme}
        title={title}
        note={note}
        eyebrow={eyebrow}
        count={shelf.count}
        pinned={shelf.reason === "pinned"}
        items={all.slice(0, shown(shelf))}
        onOpen={(k) => onOpen(k, all, title)}
        onSeeAll={() => onSeeAll(shelfHref(shelf))}
      />
    )
  }

  const renderBlock = (block: MenuBlock, shelves: MenuShelf[]) => {
    if (block === "baba") return shelves.map((sh) => itemShelf(sh, t("searchMenu.block.baba")))
    if (block === "themes") {
      return (
        <View key={block} style={s.group}>
          <BlockTitle p={p} text={t("searchMenu.themes.title")} />
          <MoodChips
            p={p}
            items={shelves.map((sh) => ({ id: sh.label.type === "theme" ? sh.label.id : sh.id, label: shelfTitle(sh), count: sh.count }))}
            onPick={(id) => onSeeAll(`/browse-shelf?id=${encodeURIComponent(`theme:${id}`)}`)}
          />
        </View>
      )
    }
    if (block === "ps") {
      const kinds = new Set(shelves.filter((sh) => sh.id.startsWith("ps:kind:")).map((sh) => sh.id.slice("ps:kind:".length)))
      const tiles = kindTiles.filter((tile) => kinds.has(tile.kind))
      return (
        <View key={block} style={s.group}>
          <BlockTitle p={p} text={t("searchMenu.block.ps")} />
          {tiles.length ? <TileGrid p={p} tiles={tiles} subOf={(tile) => t("songs.collections.count", { count: (tile as KindTile).count })} onPick={onTile} /> : null}
          {shelves.filter((sh) => !sh.id.startsWith("ps:kind:")).map((sh) => itemShelf(sh))}
        </View>
      )
    }
    if (block === "dance") {
      return (
        <View key={block} style={s.group}>
          <BlockTitle p={p} text={kindLabelPlural("dance_song")} />
          {shelves.map((sh) => itemShelf(sh))}
        </View>
      )
    }
    if (block === "more") {
      // categories the library carries that nobody listed (tempo, solo or group, occasion ...): one small heading per facet
      const facets = [...new Set(shelves.map((sh) => sh.facet ?? ""))]
      return (
        <View key={block} style={s.group}>
          <BlockTitle p={p} text={t("searchMenu.block.more")} />
          {facets.map((facet) => (
            <View key={facet} style={s.group}>
              <SubTitle p={p} text={titleCase(facet)} />
              {shelves.filter((sh) => (sh.facet ?? "") === facet).map((sh) => itemShelf(sh))}
            </View>
          ))}
        </View>
      )
    }
    if (block === "authors") {
      return (
        <View key={block} style={s.group}>
          <BlockTitle p={p} text={t(result.authorsTitleKey as "searchMenu.authors.popular")} />
          {shelves.map((sh) => itemShelf(sh))}
        </View>
      )
    }
    const key = BLOCK_TITLE[block]
    const styleShelves = shelves.filter((sh) => sh.id.startsWith("kiirtan:style:"))
    return (
      <View key={block} style={s.group}>
        {key ? <BlockTitle p={p} text={t(key)} /> : null}
        {shelves.filter((sh) => !sh.id.startsWith("kiirtan:style:")).map((sh) => itemShelf(sh))}
        {styleShelves.length ? <SubTitle p={p} text={t("searchMenu.style.title")} /> : null}
        {styleShelves.map((sh) => itemShelf(sh))}
      </View>
    )
  }

  const again = history.slice(0, 8)
  // "Search by": the ways to look, with real counts (the same stats as the shelves, whatever their thresholds)
  const searchBy = useMemo(
    () =>
      buildSearchBy({
        stats,
        psKinds: kindTiles.map((tile) => ({ kind: tile.kind, label: tile.label, count: tile.count })),
        psMoods: realCollectionEntries()
          .filter((entry) => entry.kind === "mood")
          .map((entry) => ({ id: entry.id, label: entry.label, count: entry.count, href: collectionHref(entry) })),
      }),
    // the words follow the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats, kindTiles, t],
  )

  return (
    <View style={s.root}>
      {stage ? <Text style={[overStyle, s.demo, { color: p.orange700 }]}>{t("searchMenu.demo")} · {stage}</Text> : null}
      <RecentRow p={p} items={recents} onPick={onRecent} onClear={onClearRecents} />
      <TileGrid p={p} tiles={top} big onPick={onTile} />
      {again.length ? <AgainStrip p={p} theme={theme} entries={again} onPlay={onPlayEntry} onAll={onHistory} /> : <RecentPlaysShelf p={p} items={played} onPick={onPlayed} />}
      <SearchByBlock p={p} sections={searchBy} onOpen={onSeeAll} onType={onRecent} />
      {blocks.map(({ block, shelves }) => renderBlock(block, shelves))}
      {discover.length ? <DiscoverShelf p={p} tags={discover} onPick={onTag} /> : null}
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 32, paddingTop: 20 },
  group: { gap: 20 },
  demo: { paddingHorizontal: HOME_INSET, fontFamily: amFonts.semi },
})
