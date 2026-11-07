import { artistKey, splitAuthors } from "@/lib/kirtan/artists"
import { kindLabelPlural } from "@/lib/kirtan/kind"
import { languageLabel } from "@/lib/kirtan/languages"
import { styleLabel } from "@/lib/kirtan/styles"
import { moodLabel } from "@/lib/kirtan/moods"
import { kirtanTypeLabel, type Kirtan } from "@/lib/kirtan/types"
import { listenerStatsFromHistory } from "@/lib/listening/stats"
import type { HistoryEntry } from "@/lib/listening/history"
import { aggregateRecordings, normalizeKindId } from "@/lib/searchMenu/aggregate"
import { MENU_RULES } from "@/lib/searchMenu/config"
import { BABA_AUDIO_KIND } from "@/lib/searchMenu/kinds"
import { buildMenu, rankBhajanLanguages } from "@/lib/searchMenu/rules"
import type { AuthorStat, MenuMemory, MenuRecording, MenuResult, MenuShelf, MenuStats } from "@/lib/searchMenu/types"
import { t } from "@/lib/i18n"
import { kindLabel, type CollectionKind } from "@/lib/songsV2/collectionsIndex"

/**
 * The Search menu on real data: the recordings the app holds -> counts -> `buildMenu` -> shelves, and for each shelf the
 * recordings that sit on it and the page it leads to. Pure (no React, no stores): the screen hook passes everything in.
 * Rules and thresholds: docs/search-menu.md. A shelf's items are the SAME filter that made its count, so the number on a
 * shelf is the number of recordings behind "See all".
 */

const DAY = 24 * 60 * 60 * 1000

/** A recording the menu reads. `style` and `moods` arrive with the API's fields (apps/api recordings.style, confirmed mood tags). */
export type MenuKirtan = Kirtan & { style?: string | null; styleOther?: string | null; moods?: readonly string[] | null }

/** The id behind a kind as the menu sees it: the removed kind reads as a Bhajan, `baba_audio` stays itself. */
export function menuKind(k: Pick<Kirtan, "kind">): string {
  return normalizeKindId(k.kind as string)
}

export function toMenuRecording(k: MenuKirtan): MenuRecording {
  return {
    kind: k.kind as string,
    type: k.type,
    language: k.language ?? null,
    author: k.author,
    createdAt: k.addedAt,
    plays: typeof k.plays === "number" ? k.plays : null,
    collectionId: k.collectionId ?? null,
    style: k.style ?? null,
    moods: k.moods ?? null,
  }
}

/** Authors with the listener counts the authors directory knows (`monthly_listeners`), keyed like the menu keys them. */
export type DirectoryAuthor = { name: string; recordings: number; listeners30?: number | null }

export type LiveMenuInput = {
  kirtans: readonly MenuKirtan[]
  /** Prabhat Samgiita collection kinds with how many collections each holds (lib/searchBrowse.ts) */
  psCollections: { kind: string; count: number }[]
  history: readonly HistoryEntry[]
  pins: readonly string[]
  memory: MenuMemory | undefined
  directory?: readonly DirectoryAuthor[]
  now: number
}

/** `MenuStats` from what the phone holds. The directory's listener counts are merged into the authors by name. */
export function buildLiveStats(input: LiveMenuInput): MenuStats {
  const stats = aggregateRecordings(input.kirtans.map(toMenuRecording), input.now, {
    psCollections: input.psCollections,
    listener: input.history.length ? listenerStatsFromHistory(input.history, input.now) : undefined,
    pins: input.pins.slice(0, MENU_RULES.maxPins),
    memory: input.memory,
  })
  const counted = new Map((input.directory ?? []).filter((d) => typeof d.listeners30 === "number").map((d) => [artistKey(d.name), d.listeners30 as number]))
  if (counted.size) {
    stats.authors = stats.authors.map((a: AuthorStat) => (counted.has(a.key) ? { ...a, listeners30: counted.get(a.key) } : { ...a, listeners30: 0 }))
  }
  return stats
}

export function buildLiveMenu(input: LiveMenuInput): { result: MenuResult; stats: MenuStats } {
  const stats = buildLiveStats(input)
  return { result: buildMenu(stats), stats }
}

/** Recordings of a kind, newest first. */
function newest(list: readonly MenuKirtan[]): MenuKirtan[] {
  return [...list].sort((a, b) => b.addedAt - a.addedAt)
}

const byAuthorKey = (k: Pick<Kirtan, "author">, key: string) => splitAuthors(k.author).some((name) => artistKey(name) === key)

/**
 * The recordings on a shelf, in the order the shelf shows them. Empty for a shelf of collections (`ps:kind:*`), which opens
 * the collections page instead. The list is built from published recordings only (the caller passes those).
 */
export function shelfItems(shelfId: string, kirtans: readonly MenuKirtan[], stats: Pick<MenuStats, "bhajanLanguages" | "listener">, now: number): MenuKirtan[] {
  const kind = (k: MenuKirtan) => menuKind(k)
  const kiirtans = () => kirtans.filter((k) => kind(k) === "kiirtan")
  if (shelfId === "new") return newest(kirtans.filter((k) => k.addedAt >= now - MENU_RULES.windowDays.new * DAY && k.addedAt <= now))
  if (shelfId === "mostPlayed") return [...kirtans].filter((k) => (k.plays ?? 0) > 0).sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0) || b.addedAt - a.addedAt)
  if (shelfId === "baba") return newest(kirtans.filter((k) => kind(k) === BABA_AUDIO_KIND))
  if (shelfId === "ps:recordings") return newest(kirtans.filter((k) => kind(k) === "prabhat_samgiita"))
  if (shelfId === "spiritual") return newest(kirtans.filter((k) => kind(k) === "spiritual_song"))
  if (shelfId === "kiirtan:sets") {
    const sizes = new Map<string, number>()
    for (const k of kiirtans()) if (k.collectionId) sizes.set(k.collectionId, (sizes.get(k.collectionId) ?? 0) + 1)
    return newest(kiirtans().filter((k) => k.collectionId && (sizes.get(k.collectionId) ?? 0) >= 2))
  }
  const [head, mid, tail] = shelfId.split(":")
  if (head === "kiirtan" && mid === "type") return newest(kiirtans().filter((k) => (k.type || "other") === tail))
  if (head === "kiirtan" && mid === "style") return newest(kiirtans().filter((k) => k.style === tail))
  if (head === "author") return newest(kirtans.filter((k) => kind(k) === "kiirtan" && byAuthorKey(k, shelfId.slice("author:".length))))
  if (head === "bhajan" && mid === "type") return newest(kirtans.filter((k) => kind(k) === "bhajan" && (k.type || "other") === tail))
  if (head === "bhajan" && mid === "lang") {
    const bhajans = kirtans.filter((k) => kind(k) === "bhajan")
    if (tail !== "more") return newest(bhajans.filter((k) => k.language === tail))
    const top = new Set(rankBhajanLanguages(stats).slice(0, MENU_RULES.bhajanLanguage.max).map(([code]) => code))
    return newest(bhajans.filter((k) => !k.language || k.language === "other" || !top.has(k.language)))
  }
  if (head === "theme") return newest(kirtans.filter((k) => (k.moods ?? []).includes(mid)))
  return []
}

/** The visible name of a shelf. */
export function shelfTitle(shelf: Pick<MenuShelf, "label">): string {
  const l = shelf.label
  switch (l.type) {
    case "key":
      return t(l.key as "searchMenu.new.title")
    case "psKind":
      return kindLabel(l.id as CollectionKind, true)
    case "kiirtanType":
      return kirtanTypeLabel(l.id as "bnk", "kiirtan")
    case "kiirtanStyle":
      return l.id === "other" ? t("searchMenu.kiirtan.styleOther") : styleLabel(l.id)
    case "bhajanType":
      return kirtanTypeLabel(l.id as "morning", "bhajan")
    case "language":
      return languageLabel(l.id)
    case "author":
      return l.name
    case "theme":
      return moodLabel(l.id)
  }
}

/** Where "See all" of a shelf goes: a collections page for collections, the shelf page for everything else. */
export function shelfHref(shelf: Pick<MenuShelf, "id" | "block">): string {
  if (shelf.id.startsWith("ps:kind:")) return `/collections-v2?kind=${shelf.id.slice("ps:kind:".length)}`
  return `/browse-shelf?id=${encodeURIComponent(shelf.id)}`
}

/** How many recordings the "See all" page of a shelf holds: the shelf's own count, never a made-up one. */
export function shelfCountLabel(count: number): string {
  return t("searchMenu.items", { count } as never)
}

/** The kind noun for an empty-shelf message; kept for the screens that name the kind. */
export function kindPlural(kind: string): string {
  return kind === BABA_AUDIO_KIND ? t("searchMenu.baba.title") : kindLabelPlural(kind as "kiirtan")
}

/** The label behind a shelf id, for a page opened from a link (the shelf may not be on today's menu). Null for an id nothing builds. */
export function labelFromId(id: string, authors: readonly { key: string; name: string }[] = []): MenuShelf["label"] | null {
  const key = (k: string): MenuShelf["label"] => ({ type: "key", key: k })
  if (id === "new") return key("searchMenu.new.title")
  if (id === "mostPlayed") return key("searchMenu.mostPlayed.title")
  if (id === "baba") return key("searchMenu.baba.title")
  if (id === "ps:recordings") return key("searchMenu.ps.recordings")
  if (id === "kiirtan:sets") return key("searchMenu.kiirtan.sets")
  if (id === "spiritual") return key("searchMenu.spiritual.title")
  if (id === "bhajan:lang:more") return key("searchMenu.bhajans.moreLanguages")
  const [head, mid, tail] = id.split(":")
  if (head === "kiirtan" && mid === "type" && tail) return { type: "kiirtanType", id: tail }
  if (head === "kiirtan" && mid === "style" && tail) return { type: "kiirtanStyle", id: tail }
  if (head === "bhajan" && mid === "type" && tail) return { type: "bhajanType", id: tail }
  if (head === "bhajan" && mid === "lang" && tail) return { type: "language", id: tail }
  if (head === "theme" && mid) return { type: "theme", id: mid }
  if (head === "author" && mid) {
    const name = authors.find((a) => a.key === id.slice("author:".length))?.name
    return name ? { type: "author", id: id.slice("author:".length), name } : null
  }
  return null
}
