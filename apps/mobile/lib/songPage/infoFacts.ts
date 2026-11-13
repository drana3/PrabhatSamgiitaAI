import type { CollectionItem } from "@/data/collections"
import { visiblePs, type PsCollection } from "@/lib/psCollections/parse"
import { psHref } from "@/lib/psCollections/sections"
import type { ColleagueLang } from "@/lib/psColleagues/types"
import { shortCollectionLabel } from "@/lib/songsV2/collections"

/**
 * More facts for the Info tab, only from data the app holds: the collections a song is in (Dada's Prabhat Samgiita
 * collections and the site's), and the date line the colleagues' documents write for the song (the only place the
 * archives name where a song was written). Pure; nothing is invented, a song with none of it gets no row.
 */

export type SongCollection = { key: string; label: string; href: string }

function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

/** The collections that hold the song: first the visible Prabhat Samgiita ones, then the site's. One name once. */
export function collectionsOfSong(number: number, ps: readonly PsCollection[], site: readonly CollectionItem[]): SongCollection[] {
  const out: SongCollection[] = []
  const seen = new Set<string>()
  const add = (key: string, label: string, href: string) => {
    const name = plain(label)
    if (!name || seen.has(name)) return
    seen.add(name)
    out.push({ key, label, href })
  }
  for (const c of visiblePs(ps)) {
    if (c.songs.includes(number)) add(c.key, c.title, psHref(c.key, c.title))
  }
  for (const item of site) {
    if (!item.songNumbers.includes(number)) continue
    const label = shortCollectionLabel(item.label)
    add(`site:${item.category}:${item.label}`, label, `/songs-v2-collection?id=${encodeURIComponent(item.label)}&title=${encodeURIComponent(label)}`)
  }
  return out
}

/** The first letters of the month names of each language of the documents (lower case). */
const MONTHS: Record<ColleagueLang, readonly string[]> = {
  en: ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"],
  fr: ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"],
  ru: ["янв", "февр", "март", "апр", "ма", "июн", "июл", "авг", "сент", "окт", "нояб", "дек"],
  uk: ["січ", "лют", "бер", "квіт", "трав", "черв", "лип", "серп", "вер", "жовт", "лист", "груд"],
}

type Day = { year: number; month: number; day: number }

/** Day, month and year of a date line, or null when it cannot be read with certainty. */
export function dayOfDateLine(line: string, lang: ColleagueLang): Day | null {
  const year = /(?:^|\D)((?:19|20)\d{2})(?!\d)/.exec(line)
  const day = /(?:^|\D)(\d{1,2})(?!\d)/.exec(line)
  if (!year || !day) return null
  const words = (line.toLowerCase().match(/\p{L}+/gu) ?? []).filter((w) => w.length >= 3)
  const month = MONTHS[lang].findIndex((stem) => words.some((w) => w.startsWith(stem)))
  if (month < 0) return null
  return { year: Number(year[1]), month: month + 1, day: Number(day[1]) }
}

/**
 * True when the line says more than a plain date: a place, a road, a remark after the year ("March 2, 1984, Jammu"). The
 * words that only close a Russian or Ukrainian date ("г.", "р.", "року") do not count.
 */
export function sayMoreThanDate(line: string): boolean {
  const year = /(?:19|20)\d{2}(?!\d)/.exec(line)
  if (!year) return true
  const rest = line.slice(year.index + year[0].length).replace(/^[\s.,]*(?:года|году|року|рік|г\.?|р\.?)?[\s.,]*/iu, "")
  return /\p{L}/u.test(rest)
}

export type ColleagueDate = { text: string; lang: ColleagueLang }

/**
 * The colleagues' date line worth a row of its own: the one in the app language when there is one, else English, else
 * the first there is. It is shown when it says more than the date (a place) or when the official date is missing or is
 * a different day; a bare date that agrees with the official one adds nothing and is left out.
 */
export function colleagueDateRow(
  lines: Partial<Record<ColleagueLang, string>>,
  language: string,
  official: Day | null,
): ColleagueDate | null {
  const order: ColleagueLang[] = [language as ColleagueLang, "en", "ru", "uk", "fr"]
  const lang = order.find((l, i) => order.indexOf(l) === i && Boolean(lines[l]?.trim()))
  if (!lang) return null
  const text = (lines[lang] as string).trim()
  if (sayMoreThanDate(text) || !official) return { text, lang }
  const theirs = dayOfDateLine(text, lang)
  if (theirs && theirs.year === official.year && theirs.month === official.month && theirs.day === official.day) return null
  return { text, lang }
}
