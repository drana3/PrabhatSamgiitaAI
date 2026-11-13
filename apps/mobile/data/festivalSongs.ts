import compositionDates from "../../../data/generated/composition_dates.json"

import { reviewedSongsFor } from "@/lib/festivals/reviewed"

import { allCollections } from "./collections"

/**
 * Which Prabhat Samgiita songs honestly belong to a festival or to its calendar day. Two kinds, nothing else:
 *
 * 1. "list": the festival has a list of its own in the reviewed data. The festival to list links are the ones
 *    the backend keeps in apps/api/app/services/domain_catalog.py (REVIEWED_FESTIVAL_COLLECTION_LABELS_2026,
 *    FIXED_FESTIVAL_COLLECTION_LABELS, REVIEWED_FESTIVAL_SONG_NUMBERS_2026): "only collections whose source
 *    explicitly associates songs with the observance". The lists are the collections of prabhatasamgiita.net
 *    (data/generated/theme_collections.json). The backend keys them by the 2026 date; here they are keyed by the
 *    festival, so a festival that moves (Ánanda Purnimá, Diipavalii...) keeps its list in 2027 and 2028.
 * 2. "composed": the official lyrics page prints the day a song was composed. A song composed on the same
 *    calendar day (day and month, any year) as the festival's civil date is listed as "Composed on this day".
 *    It says nothing about the festival itself, so the screens label it as what it is. The table is
 *    data/generated/composition_dates.json (scripts/build_composition_dates.py); damaged dates are left out.
 *
 * Nothing is matched by theme, mood or title. A festival with neither kind has no list and the screens show
 * nothing extra for it.
 */

type FestivalListLink = {
  /** collection labels of data/collections (theme_collections.json) whose songs belong to the festival */
  collections?: readonly string[]
  /** a reviewed list of song numbers, for a festival that has no collection of its own */
  songs?: readonly number[]
}

/** Keyed by the festival id without its year ("diipavalii-2026" is "diipavalii"). */
export const FESTIVAL_LISTS: Readonly<Record<string, FestivalListLink>> = {
  navavarsa: { collections: ["New Year Songs"] },
  "ananda-purnima": { collections: ["Bábá Birthday Songs"] },
  "baba-birthday": { collections: ["Bábá Birthday Songs"] },
  "prout-day": { collections: ["PROUT Song"] },
  shravanii: { collections: ["Shravanii Purnima Day Song"] },
  // the reviewed mix of the backend for Prabháta Saḿgiita Divasa (no collection of its own)
  "ps-divasa": { songs: [1, 68, 135, 647, 1418, 4281, 5018] },
  // the 6th day of the autumn festival is Children's Day
  sharadotsava: { collections: ["Children Songs"] },
  vijayotsava: { collections: ["Victory Day Song"] },
  diipavalii: { collections: ["Dipavali (Colour Festival) Day Songs"] },
}

/**
 * Festivals whose older list above is NOT kept once the reviewed file names songs for them: "New Year Songs" are the songs
 * of 1 January (Dada, 10 Nov 2026, decision 5), not of Navavarsa (14 April).
 */
const SUPERSEDED_LISTS: ReadonlySet<string> = new Set(["navavarsa"])

export type FestivalSongLink =
  | {
      number: number
      basis: "list"
      /** the label of the list (a collection of the catalogue), or null for the reviewed mix */
      list: string | null
    }
  | { number: number; basis: "composed"; year: number }

export type FestivalSongs = {
  /** songs of the festival's own list, in the list's order */
  listed: FestivalSongLink[]
  /** songs composed on the festival's calendar day, oldest first; a song already in the list is not repeated */
  composed: FestivalSongLink[]
  /** listed, then composed */
  all: FestivalSongLink[]
}

type DayTable = Readonly<Record<string, ReadonlyArray<readonly [number, number]>>>
const BY_DAY: DayTable = (compositionDates as unknown as { byDay: DayTable }).byDay

/** The songs composed on a calendar day, oldest first: [number, year]. */
export function songsComposedOn(month: number, day: number): ReadonlyArray<readonly [number, number]> {
  return BY_DAY[`${month}-${day}`] ?? []
}

/** The songs of one festival, see the top of this file. `festival` needs only its id and its civil date. */
export function songsForFestival(festival: { id: string; month: number; day: number }): FestivalSongs {
  const link = FESTIVAL_LISTS[festival.id.replace(/-\d{4}$/, "")]
  const listed: FestivalSongLink[] = []
  const seen = new Set<number>()
  for (const label of link?.collections ?? []) {
    const collection = allCollections.find((item) => item.label === label)
    for (const number of collection?.songNumbers ?? []) {
      if (seen.has(number)) continue
      seen.add(number)
      listed.push({ number, basis: "list", list: label })
    }
  }
  for (const number of link?.songs ?? []) {
    if (seen.has(number)) continue
    seen.add(number)
    listed.push({ number, basis: "list", list: null })
  }
  // The reviewed list (data/festivalsReviewed.json, lib/festivals/reviewed.ts) is newer than FESTIVAL_LISTS: its songs come
  // first, as the festival's own, and a song keeps the label of the collection it sits in. The older list then follows, so
  // nothing Dada said to keep is lost (Prabháta Saḿgiita Divasa's mix), except a list the reviewed file moved to another
  // festival (SUPERSEDED_LISTS). Today's card and the festival page read this one function, so they always agree.
  const reviewed = reviewedSongsFor(festival.id)
  if (reviewed.length > 0) {
    const older = listed.splice(0, listed.length).filter(() => !SUPERSEDED_LISTS.has(festival.id.replace(/-\d{4}$/, "")))
    const olderByNumber = new Map(older.map((link) => [link.number, link]))
    seen.clear()
    for (const number of reviewed) {
      if (seen.has(number)) continue
      seen.add(number)
      listed.push(olderByNumber.get(number) ?? { number, basis: "list", list: null })
    }
    for (const link of older) {
      if (seen.has(link.number)) continue
      seen.add(link.number)
      listed.push(link)
    }
  }
  const composed: FestivalSongLink[] = []
  for (const [number, year] of songsComposedOn(festival.month, festival.day)) {
    if (seen.has(number)) continue
    composed.push({ number, basis: "composed", year })
  }
  return { listed, composed, all: [...listed, ...composed] }
}

export function festivalSongCount(festival: { id: string; month: number; day: number }): number {
  return songsForFestival(festival).all.length
}
