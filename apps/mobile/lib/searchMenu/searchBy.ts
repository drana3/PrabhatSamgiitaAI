import { moodLabel } from "@/lib/kirtan/moods"
import { CUSTOM_STYLE_PREFIX, titleCase } from "@/lib/searchMenu/facets"
import { labelFromId, shelfHref, shelfTitle } from "@/lib/searchMenu/live"
import type { MenuStats } from "@/lib/searchMenu/types"
import { HINT_EXAMPLES, type SearchHint } from "@/lib/unifiedSearchQuery"
import { t } from "@/lib/i18n"

/**
 * The "Search by" block of the empty Search screen (docs/search-menu.md, section 11): everything a person can look for, in one
 * place, with how many recordings stand behind each choice. Nothing is listed that the app cannot search, and a way of looking
 * that has nothing in it yet is still shown, with one sentence saying when it will fill (so a person learns it exists).
 * Values are counted from the same stats as the shelves, whatever their thresholds: a style with one Kiirtan is searchable,
 * it just has no shelf of its own yet. Pure: no React, no stores.
 */

export type SearchByValue = {
  key: string
  label: string
  count?: number
  /** where a tap goes (a list or a collections page) */
  href?: string
  /** or text a tap puts into the search field */
  query?: string
}

export type SearchByRow = {
  id: string
  title: string
  /** a short line under the title (what to type, what the choices are) */
  note?: string
  values: SearchByValue[]
  /** said when `values` is empty: when this way of looking fills up */
  empty?: string
}

export type SearchBySection = { id: "kiirtan" | "bhajan" | "ps" | "more"; title: string; rows: SearchByRow[] }

export type SearchByInput = {
  stats: MenuStats
  /** Prabhat Samgiita collection kinds with their words and how many collections each holds (the tiles of Search) */
  psKinds: readonly { kind: string; label: string; count: number }[]
  /** the Prabhat Samgiita mood collections (the six lists of the Songs shelf) with where each opens */
  psMoods: readonly { id: string; label: string; count: number; href: string }[]
}

/** The most choices one row shows; the rest sit behind the shelf's own page. */
export const SEARCH_BY_MAX_VALUES = 10

const byCount = <T extends { count?: number; label: string }>(a: T, b: T) => (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label)

function fromCounts(counts: Readonly<Record<string, number>> | undefined, idOf: (value: string) => string, labelOf: (value: string) => string, skip: (value: string) => boolean = () => false): SearchByValue[] {
  return Object.entries(counts ?? {})
    .filter(([value, count]) => count > 0 && !skip(value))
    .map(([value, count]) => ({ key: idOf(value), label: labelOf(value), count, href: shelfHref({ id: idOf(value), block: "more" }) }))
    .sort(byCount)
    .slice(0, SEARCH_BY_MAX_VALUES)
}

/** A shelf's own word for an id (a style, a type, a language ...). */
function titleOfId(id: string): string {
  const label = labelFromId(id)
  return label ? shelfTitle({ label, id }) : titleCase(id.split(":").pop() ?? id)
}

/** How a facet's rows are named; any other facet the library carries gets its own words, titled from its name. */
const FACET_ROW: Readonly<Record<string, string>> = { instrument: "searchBy.row.instrument", recorded: "searchBy.row.recorded", performance: "searchBy.row.performance", tempo: "searchBy.row.tempo" }
const HANDLED_FACETS = new Set([...Object.keys(FACET_ROW), "dance"])

export function buildSearchBy(input: SearchByInput): SearchBySection[] {
  const { stats } = input
  const facets = stats.facets ?? {}

  // ---- Kiirtan
  const styles = fromCounts(stats.kiirtanStyles, (v) => `kiirtan:style:${v}`, (v) => (v === "other" ? t("searchMenu.kiirtan.styleOther") : v.startsWith(CUSTOM_STYLE_PREFIX) ? titleCase(v.slice(CUSTOM_STYLE_PREFIX.length)) : titleOfId(`kiirtan:style:${v}`)))
  // "Other styles" is the leftover: it goes last whatever its count
  styles.sort((a, b) => Number(a.key === "kiirtan:style:other") - Number(b.key === "kiirtan:style:other"))
  const moods: SearchByValue[] = [...stats.themes]
    .filter((m) => m.confirmed > 0)
    .map((m) => ({ key: `theme:${m.id}`, label: moodLabel(m.id), count: m.confirmed, href: shelfHref({ id: `theme:${m.id}`, block: "themes" }) }))
    .sort(byCount)
    .slice(0, SEARCH_BY_MAX_VALUES)
  // the piano has its own list (notes, or a piano lead): the instrument row points there instead of making a second one
  const instruments = fromCounts(facets.instrument, (v) => `facet:instrument:${v}`, (v) => titleOfId(`facet:instrument:${v}`), (v) => v === "piano")
  if ((stats.kiirtanPiano ?? 0) > 0) instruments.push({ key: "kiirtan:piano", label: t("searchMenu.kiirtan.piano"), count: stats.kiirtanPiano ?? 0, href: shelfHref({ id: "kiirtan:piano", block: "kiirtan" }) })
  instruments.sort(byCount)
  const facetRow = (facet: string, empty: string): SearchByRow => ({
    id: facet,
    title: t(FACET_ROW[facet] as "searchBy.row.recorded"),
    values: facet === "instrument" ? instruments : fromCounts(facets[facet], (v) => `facet:${facet}:${v}`, (v) => titleOfId(`facet:${facet}:${v}`)),
    empty,
  })
  const types = fromCounts(stats.kiirtanTypes, (v) => `kiirtan:type:${v}`, (v) => titleOfId(`kiirtan:type:${v}`))
  const kiirtanRows: SearchByRow[] = [
    { id: "style", title: t("searchBy.row.style"), values: styles, empty: t("searchBy.empty.style") },
    { id: "mood", title: t("searchBy.row.mood"), note: t("searchBy.note.mood"), values: moods, empty: t("searchBy.empty.mood") },
    facetRow("instrument", t("searchBy.empty.instrument")),
    facetRow("recorded", t("searchBy.empty.recorded")),
    facetRow("performance", t("searchBy.empty.performance")),
    facetRow("tempo", t("searchBy.empty.tempo")),
    { id: "type", title: t("searchBy.row.type"), values: types, empty: t("searchBy.empty.type") },
    {
      id: "events",
      title: t("searchBy.row.events"),
      values: stats.kiirtanSets > 0 ? [{ key: "kiirtan:sets", label: t("searchMenu.kiirtan.sets"), count: stats.kiirtanSets, href: shelfHref({ id: "kiirtan:sets", block: "kiirtan" }) }] : [],
      empty: t("searchBy.empty.events"),
    },
    {
      id: "performer",
      title: t("searchBy.row.performer"),
      note: t("searchBy.note.performer"),
      values: stats.authors.length ? [{ key: "authors", label: t("searchBy.performers"), count: stats.authors.length, href: "/authors" }] : [],
      empty: t("searchBy.empty.performer"),
    },
  ]

  // ---- Bhajans
  const bhajanRows: SearchByRow[] = [
    {
      id: "language",
      title: t("searchBy.row.language"),
      values: fromCounts(stats.bhajanLanguages, (v) => `bhajan:lang:${v}`, (v) => titleCase(titleOfId(`bhajan:lang:${v}`)), (v) => v === "other"),
      empty: t("searchBy.empty.language"),
    },
    { id: "bhajan-type", title: t("searchBy.row.bhajanType"), values: fromCounts(stats.bhajanTypes, (v) => `bhajan:type:${v}`, (v) => titleOfId(`bhajan:type:${v}`)), empty: t("searchBy.empty.type") },
  ]

  // ---- Prabhat Samgiita: what the song search has always done, now written out
  // the search index is English, so an example is typed as it is, in every language
  const ask = (hint: SearchHint): SearchByValue => ({ key: `hint:${hint}`, label: HINT_EXAMPLES[hint], query: HINT_EXAMPLES[hint] })
  const psRows: SearchByRow[] = [
    {
      id: "ps-collections",
      title: t("searchBy.row.collections"),
      note: t("searchBy.note.collections"),
      values: input.psKinds.filter((k) => k.count > 0).map((k) => ({ key: `ps:kind:${k.kind}`, label: k.label, count: k.count, href: shelfHref({ id: `ps:kind:${k.kind}`, block: "ps" }) })),
      empty: t("searchBy.empty.collections"),
    },
    {
      id: "ps-mood",
      title: t("searchBy.row.psMood"),
      note: t("searchBy.note.psMood"),
      values: input.psMoods.filter((m) => m.count > 0).map((m) => ({ key: `ps:mood:${m.id}`, label: m.label, count: m.count, href: m.href })),
      empty: t("searchBy.empty.psMood"),
    },
    { id: "ps-number", title: t("searchBy.row.number"), note: t("searchBy.note.number"), values: [ask("number")] },
    { id: "ps-first-line", title: t("searchBy.row.firstLine"), note: t("searchBy.note.firstLine"), values: [ask("words")] },
    { id: "ps-feeling", title: t("searchBy.row.feeling"), note: t("searchBy.note.feeling"), values: [ask("feeling")] },
  ]

  // ---- anything else the library carries (occasion, event name ...), found by discovery, never listed by hand
  const moreRows: SearchByRow[] = Object.entries(facets)
    .filter(([facet]) => !HANDLED_FACETS.has(facet))
    .map(([facet, counts]) => ({
      id: `facet:${facet}`,
      title: titleCase(facet),
      values: fromCounts(counts, (v) => `facet:${facet}:${v}`, (v) => titleCase(v)),
    }))
    .filter((row) => row.values.length > 0)
  const danceValues = fromCounts(facets.dance, (v) => `dance:${v}`, (v) => titleOfId(`dance:${v}`))
  if (danceValues.length) moreRows.unshift({ id: "dance", title: t("searchBy.row.dance"), values: danceValues })

  const sections: SearchBySection[] = [
    { id: "kiirtan", title: t("searchMenu.block.kiirtan"), rows: kiirtanRows },
    { id: "ps", title: t("searchMenu.block.ps"), rows: psRows },
    { id: "bhajan", title: t("searchMenu.block.bhajans"), rows: bhajanRows },
  ]
  if (moreRows.length) sections.push({ id: "more", title: t("searchMenu.block.more"), rows: moreRows })
  return sections
}
