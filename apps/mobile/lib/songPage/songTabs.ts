/**
 * The tabs of the Prabhat Samgiita song page (decision of 10 November 2026: variant V1, a short header and a switch
 * of five tabs, each one its own screen, with the photo header of V2). Pure rules, no React, so the order, the labels,
 * and what a tap on a tab does to the scroll are tested here and nowhere else.
 *
 * The tabs are always the same five in this order, for every song: Lyrics, Words, Chords, Video, Info. A tab the song
 * has nothing for does not disappear; it says honestly that there is nothing yet.
 */

export const SONG_TABS = ["lyrics", "words", "chords", "video", "info"] as const
export type SongTab = (typeof SONG_TABS)[number]

export const DEFAULT_TAB: SongTab = "lyrics"

/** The words that name a tab, as the keys of the song page's own strings (locales/songTabs.ts). */
export const TAB_LABEL_KEY = {
  lyrics: "songPage.tab.lyrics",
  words: "songTabs.words",
  chords: "songPage.tab.chords",
  video: "songPage.tab.video",
  info: "songTabs.info",
} as const satisfies Record<SongTab, string>

export function isSongTab(value: unknown): value is SongTab {
  return typeof value === "string" && (SONG_TABS as readonly string[]).includes(value)
}

/** Height of the pinned strip that holds the switch (the pill and the air around it). */
export const TAB_STRIP_HEIGHT = 48

/**
 * Where the page scrolls to when a tab is tapped: the header folds away and the strip pins under the bar, so the tab's
 * content starts right under the switch. A reader who is already further down stays where they are. Null: do not move.
 */
export function scrollOnSelect(scrollY: number, heroHeight: number): number | null {
  const fold = Math.max(0, Math.round(heroHeight))
  return scrollY < fold - 1 ? fold : null
}

/** The two pages inside the Words tab. */
export const WORDS_MODES = ["translation", "words"] as const
export type WordsMode = (typeof WORDS_MODES)[number]
export const DEFAULT_WORDS_MODE: WordsMode = "translation"

export function isWordsMode(value: unknown): value is WordsMode {
  return typeof value === "string" && (WORDS_MODES as readonly string[]).includes(value)
}
