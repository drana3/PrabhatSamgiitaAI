/**
 * Search browse menu: the shapes the adaptive rules read and write. Pure data, no React, no I/O.
 * Rules and thresholds: docs/search-menu.md. Nothing here is wired to a screen until a layout variant is chosen.
 */

/** The blocks of the menu, in the order the rules emit them (a layout may regroup them). */
export type MenuBlock = "pulse" | "baba" | "ps" | "kiirtan" | "authors" | "spiritual" | "bhajans" | "dance" | "more" | "themes"

/** Why a shelf is on the menu. `kept` = below its "on" threshold but inside the anti-flicker hold. */
export type ShelfReason = "default" | "threshold" | "popular" | "personal" | "catalogue" | "pinned" | "kept"

/** What the visible name of a shelf comes from; the screen resolves it with the app's own labels. */
export type ShelfLabel =
  | { type: "key"; key: string }
  | { type: "psKind"; id: string }
  | { type: "kiirtanType"; id: string }
  | { type: "kiirtanStyle"; id: string }
  | { type: "bhajanType"; id: string }
  | { type: "language"; id: string }
  | { type: "author"; id: string; name: string }
  | { type: "theme"; id: string }
  | { type: "dance"; id: string }
  /** a value nobody gave a title: the title is made from its words (facets.ts titleCase) */
  | { type: "named"; name: string }

export type MenuShelf = {
  /** Stable id: "new", "mostPlayed", "ps:kind:mood", "kiirtan:type:bnk", "author:<key>", "bhajan:lang:ru", "theme:<id>" ... */
  id: string
  block: MenuBlock
  label: ShelfLabel
  /** How many items the shelf holds (never fabricated; 0 never reaches the output). */
  count: number
  reason: ShelfReason
  /** Shelves found by category discovery ("facet:<facet>:<value>"): the facet they belong to (tempo, performance ...), which titles their group */
  facet?: string
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
  /** Kiirtans per style id (bengali, hindi, brajabuli, dhrupad, folk, other, and "other:<slug>" for a style someone typed); absent = none named yet */
  kiirtanStyles?: Record<string, number>
  /** Every other facet the library carries, found by category discovery (lib/searchMenu/facets.ts): facet -> value -> recordings. `dance` is one. */
  facets?: Record<string, Record<string, number>>
  /** Baba's Audio Discourses (kind baba_audio): his own voice; absent = none */
  babaAudio?: number
  /** Kiirtans with accepted piano notes or a piano lead instrument (shelf "Kiirtan for piano"); absent = none */
  kiirtanPiano?: number
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
  /** Kiirtan style ids (several), and the uploader's own style words the library may show (several); an older row has the one `style` below */
  styles?: readonly string[] | null
  stylesOther?: readonly string[] | null
  /** the one style of the first form, when the uploader named one (read as a list of one when `styles` is absent) */
  style?: string | null
  /** the uploader's own name for the style, when `style` is "other" */
  styleOther?: string | null
  /** Dance music: which dance */
  dance?: string | null
  /** any other tag the library carries (tempo, performance, occasion, event ...): facet -> values. Discovered, never listed. */
  tags?: Readonly<Record<string, readonly string[]>> | null
  /** confirmed mood ids (lib/kirtan/moods.ts) */
  moods?: readonly string[] | null
  /** counted plays since the start, when the server sends it */
  plays?: number | null
  /** event set the track belongs to */
  collectionId?: string | null
  /** accepted piano notes exist for it, or its lead instrument is the piano */
  piano?: boolean
}
