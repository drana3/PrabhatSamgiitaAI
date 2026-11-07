/**
 * Search browse menu: the shapes the adaptive rules read and write. Pure data, no React, no I/O.
 * Rules and thresholds: docs/search-menu.md. Nothing here is wired to a screen until a layout variant is chosen.
 */

/** The blocks of the menu, in the order the rules emit them (a layout may regroup them). */
export type MenuBlock = "pulse" | "ps" | "kiirtan" | "authors" | "spiritual" | "bhajans" | "themes"

/** Why a shelf is on the menu. `kept` = below its "on" threshold but inside the anti-flicker hold. */
export type ShelfReason = "default" | "threshold" | "popular" | "personal" | "catalogue" | "pinned" | "kept"

/** What the visible name of a shelf comes from; the screen resolves it with the app's own labels. */
export type ShelfLabel =
  | { type: "key"; key: string }
  | { type: "psKind"; id: string }
  | { type: "kiirtanType"; id: string }
  | { type: "bhajanType"; id: string }
  | { type: "language"; id: string }
  | { type: "author"; id: string; name: string }
  | { type: "theme"; id: string }

export type MenuShelf = {
  /** Stable id: "new", "mostPlayed", "ps:kind:mood", "kiirtan:type:bnk", "author:<key>", "bhajan:lang:ru", "theme:<id>" ... */
  id: string
  block: MenuBlock
  label: ShelfLabel
  /** How many items the shelf holds (never fabricated; 0 never reaches the output). */
  count: number
  reason: ShelfReason
  /** Only "mostPlayed": counted in the last 30 days, or since the start. The screen must say which. */
  source?: "window" | "lifetime"
}

/** Counts of one author of the catalogue. `plays30`/`listeners30` stay undefined until the server counts them. */
export type AuthorStat = {
  /** normalised name (case and spacing do not make another author) */
  key: string
  name: string
  recordings: number
  plays30?: number
  /** distinct listeners in 30 days (docs/author-profiles.md); resists one person looping a track */
  listeners30?: number
}

/** What THIS listener did, from this device only. Never sent anywhere. */
export type ListenerStats = {
  /** author key -> counted plays in the personal window and the distinct recordings among them */
  authors?: Record<string, { plays: number; distinct: number }>
  /** language code -> counted plays in the personal window */
  languages?: Record<string, number>
}

export type ThemeStat = { id: string; confirmed: number }

export type MenuStats = {
  /** ms since epoch */
  now: number
  /** non-empty collections of Prabhat Samgiita songs by kind, in display order */
  psCollections: { kind: string; count: number }[]
  /** performances of Prabhat Samgiita songs */
  psRecordings: number
  /** Kiirtans per type id (bnk, lila, festival, other) */
  kiirtanTypes: Record<string, number>
  /** event sets with at least two published tracks */
  kiirtanSets: number
  /** Bhajans per language code; recordings without a language are not counted here */
  bhajanLanguages: Record<string, number>
  /** Bhajans per type id (morning, evening, devotional, other) */
  bhajanTypes: Record<string, number>
  spiritualSongs: number
  authors: AuthorStat[]
  /** recordings created in the last 30 days (by created_at) */
  newInWindow: number
  /** counted plays; `source: "none"` until the server delivers them */
  played: {
    source: "window" | "lifetime" | "none"
    recordingsWithPlays: number
    totalPlays: number
  }
  themes: ThemeStat[]
  listener?: ListenerStats
  /** shelf ids the team pinned (at most MENU_RULES.maxPins count) */
  pins?: string[]
  /** what the previous menu looked like (see `MenuMemory`) */
  memory?: MenuMemory
}

/** Remembered between opens so a shelf does not flicker at its threshold. Store it on the device. */
export type MenuMemory = {
  /** shelf id -> ms since epoch when it first appeared */
  shown: Record<string, number>
  /** shelf ids in the order the last menu showed them */
  order: string[]
}

export type HiddenShelf = { id: string; why: "empty" | "below-threshold" | "no-data" | "over-limit" }

export type MenuResult = {
  shelves: MenuShelf[]
  /** feed this back as `memory` next time */
  memory: MenuMemory
  /** why candidates are not on the menu; for the debug view and tests, not for people */
  hidden: HiddenShelf[]
  /** i18n key of the title of the "authors" block: "popular" only when real listener counts back it */
  authorsTitleKey: string
}

/** A recording as the rules need it (a subset of the API's RecordingOut). */
export type MenuRecording = {
  kind: string
  type?: string | null
  language?: string | null
  author: string
  /** ms since epoch (created_at) */
  createdAt: number
  /** counted plays since the start, when the server sends it */
  plays?: number | null
  /** event set the track belongs to */
  collectionId?: string | null
}
