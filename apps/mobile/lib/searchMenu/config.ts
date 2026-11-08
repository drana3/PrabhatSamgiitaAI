/**
 * Every knob of the adaptive menu in one place. Change a number here and the tests, the doc table
 * (docs/search-menu.md) and the behaviour move together. "on" = count needed to appear;
 * "off" = count below which an already visible shelf disappears (on > off, so a shelf at the edge does not blink).
 */
export const MENU_RULES = {
  windowDays: { new: 30, popular: 30, personal: 60 },
  /** a shelf that appeared stays at least this long unless it is empty */
  holdDays: 7,
  maxShelves: 14,
  maxPins: 3,

  /** Baba's own voice is rare and wanted: one recording is enough, and the shelf is never the one dropped by the cap */
  baba: { on: 1, off: 1 },
  kiirtanStyle: { on: 3, off: 2 },

  newMonth: { on: 3, off: 2, show: 12 },
  /** "Most played" needs real counts: this many recordings with plays and this many plays in all */
  mostPlayed: { minRecordings: 5, minTotalPlays: 50, show: 10 },

  psRecordings: { on: 3, off: 2 },
  kiirtanType: { on: 3, off: 2 },
  kiirtanSets: { on: 2, off: 1 },
  spiritual: { on: 3, off: 2 },
  bhajanLanguage: { on: 3, off: 2, max: 5 },
  bhajanType: { on: 3, off: 2 },
  /** Moods are discovered from the tags on recordings: a mood is a shelf at 3 recordings that carry it, gone under 2 */
  theme: { on: 3, off: 2, max: 8 },
  /** Any other facet the library carries (dance, tempo, solo or group, occasion, event name ...): per value, at most `max` values per facet. Override one facet in `facetOverrides`. */
  facet: { on: 3, off: 2, max: 6 },

  authors: {
    /** the author has this many published recordings */
    minRecordings: 3,
    /** popular: this many distinct listeners in the window */
    minListeners: 5,
    /** personal: this listener played the author this often, over this many different recordings */
    personalPlays: 5,
    personalDistinct: 3,
    personalMinRecordings: 2,
    max: 4,
    maxPersonal: 2,
    /** cold start (no listener counts anywhere): authors with this many recordings, at most `coldMax` */
    coldMinRecordings: 5,
    coldMax: 3,
  },
} as const

/** A facet that needs its own numbers (facet id -> rule). Empty: every facet follows `MENU_RULES.facet`. */
export const FACET_OVERRIDES: Readonly<Record<string, { readonly on: number; readonly off: number; readonly max: number }>> = {}

/**
 * Titles the team chose for a shelf, by shelf id ("kiirtan:style:other:baul": "Baul"). A value nobody renamed gets a title
 * made from its own words, so this stays empty until someone wants a different word.
 */
export const MENU_LABEL_OVERRIDES: Readonly<Record<string, string>> = {}

export type OnOff = { readonly on: number; readonly off: number }

/** Visible words the menu rules name. Each exists in locales/en, ru and es (a test checks it). */
export const MENU_TITLE_KEYS = [
  "searchMenu.new.title",
  "searchMenu.mostPlayed.title",
  "searchMenu.mostPlayed.window",
  "searchMenu.mostPlayed.lifetime",
  "searchMenu.ps.recordings",
  "searchMenu.kiirtan.sets",
  "searchMenu.baba.title",
  "searchMenu.block.baba",
  "searchMenu.kiirtan.styleOther",
  "searchMenu.authors.popular",
  "searchMenu.authors.catalogue",
  "searchMenu.spiritual.title",
  "searchMenu.bhajans.moreLanguages",
  "searchMenu.block.ps",
  "searchMenu.block.kiirtan",
  "searchMenu.block.bhajans",
  "searchMenu.block.themes",
  "searchMenu.block.more",
  "searchMenu.demo",
] as const
