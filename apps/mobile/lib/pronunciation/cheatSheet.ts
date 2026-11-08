import type { PronGroup, PronLanguage, PronRule, PronSample } from "@/data/pronunciation/types"
import { buildMemo } from "./memo"

/**
 * The pronunciation cheat-sheet: the same rules as the long memo (lib/pronunciation/memo.ts), cut into the six
 * groups a child can scan: "You see" on the left, "It sounds like" on the right. Pure: no text of its own, nothing
 * invented. Every line the sheet shows is a `pron.<rule id>.like` or `pron.<rule id>.text` string of
 * locales/pronunciation.ts; this file only decides the order, which letters fit in the left column, and which rows
 * belong to the song that is open.
 */

/** The six groups, in the order the sheet shows them. They are the data's own groups: nothing is regrouped. */
export const CHEAT_GROUPS = ["vowel", "consonant", "nasal", "sibilant", "special", "general"] as const satisfies readonly PronGroup[]

export type CheatGroupId = (typeof CHEAT_GROUPS)[number]

/** How many letters of a rule fit in the "You see" column; the rest are named when the row is opened. */
export const MAX_SHOWN_SYMBOLS = 4

export type CheatRow = {
  rule: PronRule
  /** a letter of the rule occurs in the open song */
  inSong: boolean
  /** the symbols for the left column (at most MAX_SHOWN_SYMBOLS) */
  shown: string[]
  /** the rule has more symbols than the column shows */
  more: boolean
  /** the word the row's play button speaks; none for a rule that is explained in words only */
  first: PronSample | null
  /** a native speaker has not confirmed it yet and the sources do not settle it: the row says so, quietly */
  checking: boolean
}

export type CheatGroup = {
  id: CheatGroupId
  rows: CheatRow[]
  inSong: number
  checking: number
}

export type CheatSheet = {
  language: PronLanguage
  groups: CheatGroup[]
  /** how many rules are in the sheet */
  total: number
  /** how many of them are still being checked */
  checking: number
  /** how many rules have a letter in the open song */
  inSong: number
}

export function buildCheatSheet(language: PronLanguage, roman: string | null | undefined): CheatSheet {
  const memo = buildMemo(language, roman)
  const inSong = new Set(memo.inSong.map((rule) => rule.id))
  const rules = [...memo.general, ...memo.inSong, ...memo.others]
  const groups: CheatGroup[] = CHEAT_GROUPS.map((id) => {
    const rows = rules
      .filter((rule) => rule.group === id)
      .map<CheatRow>((rule) => ({
        rule,
        inSong: inSong.has(rule.id),
        shown: rule.symbols.slice(0, MAX_SHOWN_SYMBOLS),
        more: rule.symbols.length > MAX_SHOWN_SYMBOLS,
        first: rule.samples[0] ?? null,
        checking: rule.status === "needs-native-check",
      }))
    // the letters of this song first; inside each half the data's own order stays
    const ordered = [...rows.filter((row) => row.inSong), ...rows.filter((row) => !row.inSong)]
    return { id, rows: ordered, inSong: rows.filter((row) => row.inSong).length, checking: rows.filter((row) => row.checking).length }
  })
  return {
    language,
    groups,
    total: rules.length,
    checking: groups.reduce((sum, group) => sum + group.checking, 0),
    inSong: inSong.size,
  }
}

/** The first sentence of a rule text: what a collapsed row shows when the rule has no "sounds like" line. */
export function firstSentence(text: string): string {
  const match = /^.*?[.!?](?=\s|$)/s.exec(text.trim())
  return (match ? match[0] : text).trim()
}
