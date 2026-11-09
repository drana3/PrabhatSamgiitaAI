import { cleanWord, normalizedWord, wordProblem } from "@/lib/kirtan/instruments"

/**
 * The tags of one field (a style, a mood): ids from a short list plus the person's own words (Dada, 9 Nov 2026). The compact picker
 * (components/kirtan/add/TagPicker.tsx) edits a `TagValue`; this file holds every rule, so the screen has none and the rules are
 * unit tested (__tests__/tagPicker.test.ts). The numbers are the API's (`apps/api/app/services/recording_tags.py`): at most five tags
 * in all, at most two of them the person's own words, each own word 2 to 40 characters.
 * Pure: no React, no stores.
 */
export const TAGS_MAX = 5
export const OWN_TAGS_MAX = 2

export type TagValue = { ids: readonly string[]; own: readonly string[] }
export const NO_TAGS: TagValue = { ids: [], own: [] }

/** Why a change was not made: the list is full, the word is too short, two own words are there already. */
export type TagProblem = "full" | "short" | "ownFull" | null

export function tagCount(value: TagValue): number {
  return value.ids.length + value.own.length
}

/** A listed id on or off. When it is off and the field is full, nothing changes and the problem says why. */
export function toggleTag(value: TagValue, id: string, max: number = TAGS_MAX): { value: TagValue; problem: TagProblem } {
  if (value.ids.includes(id)) return { value: { ...value, ids: value.ids.filter((x) => x !== id) }, problem: null }
  if (tagCount(value) >= max) return { value, problem: "full" }
  return { value: { ...value, ids: [...value.ids, id] }, problem: null }
}

/**
 * The person's own word added. A word that IS a listed one (`listedFor` says which id) is that listed tag turned on instead; a word already
 * there (any case) changes nothing and is no problem; a word under two letters, a third own word or a sixth tag are refused with the reason.
 */
export function addOwnTag(value: TagValue, text: string, opts: { listedFor?: (word: string) => string | null; max?: number } = {}): { value: TagValue; problem: TagProblem } {
  const max = opts.max ?? TAGS_MAX
  if (wordProblem(text)) return { value, problem: "short" }
  const word = cleanWord(text)
  const listed = opts.listedFor?.(word) ?? null
  if (listed) return value.ids.includes(listed) ? { value, problem: null } : toggleTag(value, listed, max)
  if (value.own.some((w) => normalizedWord(w) === normalizedWord(word))) return { value, problem: null }
  if (value.own.length >= OWN_TAGS_MAX) return { value, problem: "ownFull" }
  if (tagCount(value) >= max) return { value, problem: "full" }
  return { value: { ...value, own: [...value.own, word] }, problem: null }
}

export function removeOwnTag(value: TagValue, word: string): TagValue {
  return { ...value, own: value.own.filter((w) => w !== word) }
}

/** Both kinds of chip in the order the line shows them: the listed ones as chosen, then the own words. */
export function chipsOf(value: TagValue, labelOf: (id: string) => string): { key: string; label: string; own: boolean }[] {
  return [...value.ids.map((id) => ({ key: `id-${id}`, label: labelOf(id), own: false })), ...value.own.map((w) => ({ key: `own-${normalizedWord(w)}`, label: w, own: true }))]
}

/** The options whose label (or id) holds what was typed, case, accents and punctuation aside. An empty search shows all. */
export function filterOptions<T extends { id: string; label: string }>(options: readonly T[], query: string): T[] {
  const q = normalizedWord(query)
  if (!q) return [...options]
  return options.filter((o) => normalizedWord(o.label).includes(q) || normalizedWord(o.id.replace(/_/g, " ")).includes(q))
}

/** Is what was typed a word the person could add as their own (not empty, not exactly one of the options)? */
export function canAddOwn(query: string, options: readonly { id: string; label: string }[]): boolean {
  const q = normalizedWord(query)
  return q.length > 0 && !options.some((o) => normalizedWord(o.label) === q)
}

/**
 * How many chips fit on the one line of the rail, by the length of their words: the chips that fit are shown whole and the rest
 * become one "+N" chip, so no word is cut ("Indian st..."). At least one chip is always shown (a very long one may still be clipped).
 * Widths are an estimate of the 14 px semibold chip on a 390 pt phone: 7.6 per letter, 24 of padding, 8 between chips.
 */
export const RAIL_WIDTH = 214
const RAIL_PLUS = 44
export function fitRailChips<T extends { label: string }>(chips: readonly T[], width: number = RAIL_WIDTH): { shown: T[]; more: number } {
  const wide = (chip: T) => chip.label.length * 7.6 + 24
  const shown: T[] = []
  let used = 0
  for (let index = 0; index < chips.length; index += 1) {
    const chip = chips[index] as T
    const last = index === chips.length - 1
    const next = used + (shown.length ? 8 : 0) + wide(chip)
    // a chip that is not the last one must leave room for the "+N" chip behind it
    if (shown.length && next + (last ? 0 : 8 + RAIL_PLUS) > width) break
    shown.push(chip)
    used = next
  }
  return { shown, more: chips.length - shown.length }
}
