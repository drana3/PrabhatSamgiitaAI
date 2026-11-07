import { MENU_RULES, type OnOff } from "@/lib/searchMenu/config"
import type {
  AuthorStat,
  HiddenShelf,
  MenuBlock,
  MenuMemory,
  MenuResult,
  MenuShelf,
  MenuStats,
  ShelfLabel,
  ShelfReason,
} from "@/lib/searchMenu/types"

/**
 * The adaptive rules of the search browse menu (docs/search-menu.md). Input: counts. Output: the shelves
 * to show, in order. Pure: same input, same output; no clock, no storage, no network.
 *
 * What the rules promise:
 * - A shelf with nothing in it is never shown. A number is never made up: "Most played" needs real play counts
 *   and stays away until the server sends them.
 * - Appearing needs `on`; an already visible shelf only leaves below `off`, and stays `holdDays` unless empty.
 * - Order is fixed by block, then by a plain rule inside the block. Shelves that were visible keep their relative
 *   order, so the menu does not shuffle between two opens.
 * - The team can pin a shelf (needs at least one item). Pins skip the thresholds, never the "not empty" rule.
 */

const DAY = 24 * 60 * 60 * 1000

type Candidate = {
  id: string
  block: MenuBlock
  label: ShelfLabel
  count: number
  /** the rule that lets it in when it passes; undefined = no rule can (always hidden) */
  threshold: OnOff | null
  reason: ShelfReason
  /** higher first inside the block */
  score: number
  source?: MenuShelf["source"]
  /** passes without any threshold (the catalogue of songs: it exists or it does not) */
  alwaysIfAny?: boolean
}

const BLOCK_ORDER: readonly MenuBlock[] = ["pulse", "baba", "ps", "kiirtan", "authors", "spiritual", "bhajans", "themes"]

/** The named Bhajan languages in the order the menu ranks them (your own listening first, then by count, then by code). The first `bhajanLanguage.max` get shelves; the rest go into "More languages". */
export function rankBhajanLanguages(stats: Pick<MenuStats, "bhajanLanguages" | "listener">): [string, number][] {
  const personalLang = stats.listener?.languages ?? {}
  const score = (code: string, n: number) => n + ((personalLang[code] ?? 0) >= MENU_RULES.authors.personalPlays ? 1_000_000 : 0)
  return Object.entries(stats.bhajanLanguages)
    .filter(([code]) => code !== "other" && code !== "")
    .sort(([a, x], [b, y]) => score(b, y) - score(a, x) || a.localeCompare(b))
}

function candidatesOf(stats: MenuStats): { all: Candidate[]; hidden: HiddenShelf[] } {
  const R = MENU_RULES
  const all: Candidate[] = []
  const hidden: HiddenShelf[] = []

  // ---- pulse: New this month, Most played
  all.push({
    id: "new", block: "pulse", label: { type: "key", key: "searchMenu.new.title" },
    count: stats.newInWindow, threshold: R.newMonth, reason: "threshold", score: 2,
  })
  const p = stats.played
  if (p.source === "none") {
    hidden.push({ id: "mostPlayed", why: "no-data" })
  } else if (p.recordingsWithPlays < R.mostPlayed.minRecordings || p.totalPlays < R.mostPlayed.minTotalPlays) {
    hidden.push({ id: "mostPlayed", why: "below-threshold" })
  } else {
    all.push({
      id: "mostPlayed", block: "pulse", label: { type: "key", key: "searchMenu.mostPlayed.title" },
      count: p.recordingsWithPlays, threshold: { on: 1, off: 1 }, reason: "threshold", score: 1, source: p.source,
    })
  }

  // ---- Baba's Audio Discourses (his own voice, right after the pulse)
  all.push({
    id: "baba", block: "baba", label: { type: "key", key: "searchMenu.baba.title" },
    count: stats.babaAudio ?? 0, threshold: R.baba, reason: "threshold", score: 0,
  })

  // ---- 1. Prabhat Samgiita
  stats.psCollections.forEach((c, i) => {
    all.push({
      id: `ps:kind:${c.kind}`, block: "ps", label: { type: "psKind", id: c.kind },
      count: c.count, threshold: null, reason: "default", score: 1000 - i, alwaysIfAny: true,
    })
  })
  all.push({
    id: "ps:recordings", block: "ps", label: { type: "key", key: "searchMenu.ps.recordings" },
    count: stats.psRecordings, threshold: R.psRecordings, reason: "threshold", score: 0,
  })

  // ---- 2. Kiirtan: types, event sets
  for (const [id, count] of Object.entries(stats.kiirtanTypes)) {
    all.push({
      id: `kiirtan:type:${id}`, block: "kiirtan", label: { type: "kiirtanType", id },
      count, threshold: R.kiirtanType, reason: "threshold", score: id === "other" ? -1 : count,
    })
  }
  for (const [id, count] of Object.entries(stats.kiirtanStyles ?? {})) {
    all.push({
      id: `kiirtan:style:${id}`, block: "kiirtan", label: { type: "kiirtanStyle", id },
      count, threshold: R.kiirtanStyle, reason: "threshold", score: id === "other" ? -2 : count - 0.5,
    })
  }
  all.push({
    id: "kiirtan:sets", block: "kiirtan", label: { type: "key", key: "searchMenu.kiirtan.sets" },
    count: stats.kiirtanSets, threshold: R.kiirtanSets, reason: "threshold", score: 0,
  })

  // ---- 3. Authors
  const known = stats.authors.filter((a) => a.recordings > 0)
  const personal = stats.listener?.authors ?? {}
  const countsExist = known.some((a) => a.listeners30 !== undefined)
  for (const a of known) {
    const mine = personal[a.key]
    const isPersonal =
      !!mine && mine.plays >= R.authors.personalPlays && mine.distinct >= R.authors.personalDistinct &&
      a.recordings >= R.authors.personalMinRecordings
    const isPopular =
      a.recordings >= R.authors.minRecordings && (a.listeners30 ?? 0) >= R.authors.minListeners
    const isCold =
      !countsExist && a.recordings >= R.authors.coldMinRecordings
    let reason: ShelfReason | null = null
    let score = 0
    if (isPersonal) { reason = "personal"; score = 1_000_000 + mine!.plays }
    else if (isPopular) { reason = "popular"; score = 1000 + (a.listeners30 ?? 0) + (a.plays30 ?? 0) / 1000 }
    else if (isCold) { reason = "catalogue"; score = a.recordings }
    all.push({
      id: `author:${a.key}`, block: "authors", label: { type: "author", id: a.key, name: a.name },
      count: a.recordings,
      // an author who is not personal/popular/cold has no rule that lets them in; a pin or the hold still can
      threshold: reason ? { on: 1, off: 1 } : null,
      reason: reason ?? "threshold", score,
    })
  }

  // ---- 4. Spiritual songs
  all.push({
    id: "spiritual", block: "spiritual", label: { type: "key", key: "searchMenu.spiritual.title" },
    count: stats.spiritualSongs, threshold: R.spiritual, reason: "threshold", score: 0,
  })

  // ---- 5. Bhajans by language (then by type)
  const personalLang = stats.listener?.languages ?? {}
  const scoreLang = (code: string, n: number) => n + ((personalLang[code] ?? 0) >= R.authors.personalPlays ? 1_000_000 : 0)
  const ranked = rankBhajanLanguages(stats)
  ranked.forEach(([code, n], i) => {
    all.push({
      id: `bhajan:lang:${code}`, block: "bhajans", label: { type: "language", id: code },
      count: n, threshold: i < R.bhajanLanguage.max ? R.bhajanLanguage : null, reason: (personalLang[code] ?? 0) >= R.authors.personalPlays ? "personal" : "threshold",
      score: scoreLang(code, n),
    })
  })
  // the languages past the cap, with "other", become one shelf so no Bhajan is unreachable
  const rest = ranked.slice(R.bhajanLanguage.max).reduce((s, [, n]) => s + n, 0) + (stats.bhajanLanguages.other ?? 0)
  all.push({
    id: "bhajan:lang:more", block: "bhajans", label: { type: "key", key: "searchMenu.bhajans.moreLanguages" },
    count: rest, threshold: R.bhajanLanguage, reason: "threshold", score: -1,
  })
  for (const [id, count] of Object.entries(stats.bhajanTypes)) {
    all.push({
      id: `bhajan:type:${id}`, block: "bhajans", label: { type: "bhajanType", id },
      count, threshold: R.bhajanType, reason: "threshold", score: -10 + count / 1_000_000 - (id === "other" ? 1 : 0),
    })
  }

  // ---- themes (confirmed tags)
  const themes = [...stats.themes].sort((a, b) => b.confirmed - a.confirmed || a.id.localeCompare(b.id))
  themes.forEach((th, i) => {
    all.push({
      id: `theme:${th.id}`, block: "themes", label: { type: "theme", id: th.id },
      count: th.confirmed, threshold: i < R.theme.max ? R.theme : null, reason: "threshold", score: th.confirmed,
    })
  })

  return { all, hidden }
}

/** Does the candidate pass its threshold, given whether it was visible before and how long ago it first appeared? */
function passes(c: Candidate, memory: MenuMemory | undefined, now: number): ShelfReason | null {
  if (c.count <= 0) return null
  if (c.alwaysIfAny) return c.reason
  const since = memory?.shown[c.id]
  const held = since !== undefined && now - since < MENU_RULES.holdDays * DAY
  if (!c.threshold) return held ? "kept" : null
  if (c.count >= c.threshold.on) return c.reason
  if (since !== undefined && c.count >= c.threshold.off) return "kept"
  return held ? "kept" : null
}

/** Rank inside a block: pinned first, then previously shown shelves in their old order, then by score. */
function sortBlock(items: MenuShelf[], scores: Map<string, number>, memory: MenuMemory | undefined): MenuShelf[] {
  const old = new Map((memory?.order ?? []).map((id, i) => [id, i]))
  const pinned = items.filter((s) => s.reason === "pinned")
  const rest = items.filter((s) => s.reason !== "pinned")
  const byScore = (a: MenuShelf, b: MenuShelf) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || a.id.localeCompare(b.id)
  // personal shelves lead; the rest keep their old relative order, newcomers go in by score after the ones that stayed
  const personal = rest.filter((s) => s.reason === "personal").sort(byScore)
  const others = rest.filter((s) => s.reason !== "personal")
  const stayed = others.filter((s) => old.has(s.id)).sort((a, b) => old.get(a.id)! - old.get(b.id)!)
  const fresh = others.filter((s) => !old.has(s.id)).sort(byScore)
  return [...pinned.sort(byScore), ...personal, ...stayed, ...fresh]
}

/** Build the menu. See the file comment for the promises. */
export function buildMenu(stats: MenuStats): MenuResult {
  const R = MENU_RULES
  const { all, hidden } = candidatesOf(stats)
  const pins = new Set((stats.pins ?? []).slice(0, R.maxPins))
  const scores = new Map<string, number>()
  const kept: MenuShelf[] = []

  for (const c of all) {
    scores.set(c.id, c.score)
    if (c.count <= 0) { hidden.push({ id: c.id, why: "empty" }); continue }
    let reason = passes(c, stats.memory, stats.now)
    if (pins.has(c.id)) reason = "pinned"
    if (!reason) { hidden.push({ id: c.id, why: "below-threshold" }); continue }
    // the cap on authors is applied after sorting, below
    kept.push({
      id: c.id, block: c.block, label: c.label, count: c.count, reason,
      ...(c.source ? { source: c.source } : {}),
    })
  }

  // per-block caps that depend on rank
  const byBlock = (b: MenuBlock) => kept.filter((s) => s.block === b)
  let authors = sortBlock(byBlock("authors"), scores, stats.memory)
  const keepAuthor = (s: MenuShelf, i: number, list: MenuShelf[]) => {
    if (s.reason === "pinned") return true
    if (s.reason === "personal") return list.filter((x, j) => j <= i && x.reason === "personal").length <= R.authors.maxPersonal
    if (s.reason === "catalogue") return list.filter((x, j) => j <= i && x.reason === "catalogue").length <= R.authors.coldMax
    return true
  }
  authors = authors.filter(keepAuthor)
  const authorCap = authors.filter((s) => s.reason !== "pinned").slice(0, R.authors.max)
  authors = [...authors.filter((s) => s.reason === "pinned"), ...authorCap]
  for (const s of byBlock("authors")) if (!authors.includes(s)) hidden.push({ id: s.id, why: "over-limit" })

  let ordered: MenuShelf[] = []
  for (const block of BLOCK_ORDER) {
    const items = block === "authors" ? authors : sortBlock(byBlock(block), scores, stats.memory)
    ordered = ordered.concat(items)
  }

  // global cap: drop from the end, never a pinned shelf, Baba's voice or a compact group. Prabhat Samgiita collections (one
  // tile grid) and moods (one row of chips) are compact: they do not use up the 14 and are not dropped by the cap.
  const compact = (s: MenuShelf) => s.id.startsWith("ps:kind:") || s.block === "themes"
  const counted = () => ordered.filter((s) => !compact(s)).length
  while (counted() > R.maxShelves) {
    let i = ordered.length - 1
    while (i >= 0 && (ordered[i].reason === "pinned" || ordered[i].id === "baba" || compact(ordered[i]))) i--
    if (i < 0) break
    hidden.push({ id: ordered[i].id, why: "over-limit" })
    ordered.splice(i, 1)
  }

  const shown: Record<string, number> = {}
  for (const s of ordered) shown[s.id] = stats.memory?.shown[s.id] ?? stats.now
  return {
    shelves: ordered,
    memory: { shown, order: ordered.map((s) => s.id) },
    hidden,
    authorsTitleKey: ordered.some((s) => s.block === "authors" && s.reason === "popular")
      ? "searchMenu.authors.popular"
      : "searchMenu.authors.catalogue",
  }
}

/** True when the menu would show only the always-present collections (cold start). */
export function isColdStart(result: MenuResult): boolean {
  return result.shelves.every((s) => s.block === "ps")
}

export type { AuthorStat }
