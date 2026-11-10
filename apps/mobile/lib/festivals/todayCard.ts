import { festivalCalendar, type UpcomingFestival } from "@/data/festivals"
import { songsForFestival, type FestivalSongLink, type FestivalSongs } from "@/data/festivalSongs"
import { daysUntilFestival } from "@/lib/festivalEve"
import { festivalBaseId, festivalText } from "@/lib/i18n/festivalText"
import { formatDate } from "@/lib/i18n/format"
import type { Language } from "@/lib/i18n/core"
import { REVIEWED_FESTIVALS, type ReviewedFestival } from "@/lib/festivals/reviewed"

/**
 * Today's festival card (Dada, 10 November 2026): it is the FIRST block of the page, it appears two days before a
 * festival (by the calendar days on the phone, not a 48-hour count), stays the day before and on the day itself, and is gone
 * the next morning. A festival with no confirmed song gets no card. The festivals and their songs come from the reviewed
 * list (lib/festivals/reviewed.ts), so the final file replaces the data without a code change. Pure: `now` is a parameter.
 */
export const CARD_LEAD_DAYS = 2

export type CardPhase = "today" | "tomorrow" | "soon"

export function cardPhase(daysUntil: number): CardPhase | null {
  if (daysUntil === 0) return "today"
  if (daysUntil === 1) return "tomorrow"
  return daysUntil >= 2 && daysUntil <= CARD_LEAD_DAYS ? "soon" : null
}

export type TodayFestivalCard = {
  /** id in the reviewed list, the card's key */
  id: string
  /** the app calendar's festival page for this very date (`/festival/<id>`), or null when the app has none (then no "See all") */
  pageId: string | null
  year: number
  month: number
  day: number
  daysUntil: number
  phase: CardPhase
  /** the date is worked out by the rule, not published yet */
  expected: boolean
  nameEn: string
  nameRu: string
  /** the reviewed songs first, then the songs composed on that calendar day (data/festivalSongs.ts): the festival page's list */
  songs: FestivalSongs
}

/** The festival cards due on `now`'s calendar day, the nearest first, at most `limit`. */
export function todayFestivalCards(
  now: Date,
  limit = 2,
  source: readonly ReviewedFestival[] = REVIEWED_FESTIVALS,
  calendar: readonly UpcomingFestival[] = festivalCalendar,
  songsFor: (festival: { id: string; month: number; day: number }) => FestivalSongs = songsForFestival,
): TodayFestivalCard[] {
  const out: TodayFestivalCard[] = []
  for (const festival of source) {
    if (festival.songs.length === 0) continue
    for (const date of festival.dates) {
      const daysUntil = daysUntilFestival(now, date)
      const phase = cardPhase(daysUntil)
      if (!phase) continue
      const base = festival.appBaseId ?? festival.id
      const page = calendar.find((c) => festivalBaseId(c.id) === base && c.year === date.year && c.month === date.month && c.day === date.day)
      const songs = songsFor({ id: `${base}-${date.year}`, month: date.month, day: date.day })
      if (songs.all.length === 0) continue
      out.push({
        id: `${festival.id}-${date.year}`,
        pageId: page?.id ?? null,
        year: date.year,
        month: date.month,
        day: date.day,
        daysUntil,
        phase,
        expected: festival.derivedYears.has(date.year),
        nameEn: festival.nameEn,
        nameRu: festival.nameRu,
        songs,
      })
    }
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, Math.max(0, limit))
}

/** "Sharadotsava and Children's Day" in the language on screen: the app calendar's caption where it has one, else the reviewed list's name. */
export function festivalCardTitle(card: Pick<TodayFestivalCard, "id" | "nameEn" | "nameRu">, language: Language, calendar: readonly UpcomingFestival[] = festivalCalendar): string {
  const reviewedId = card.id.replace(/-\d{4}$/, "")
  const base = REVIEWED_FESTIVALS.find((f) => f.id === reviewedId)?.appBaseId ?? reviewedId
  const known = calendar.find((c) => festivalBaseId(c.id) === base)
  if (known) return festivalText(known, language).title
  const plain = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "").trim()
  return language === "ru" && card.nameRu ? plain(card.nameRu) : plain(card.nameEn)
}

/** The date line's day: "10 Nov" this year, "10 Nov 2027" another year. */
export function cardDateLabel(card: Pick<TodayFestivalCard, "year" | "month" | "day">, now: Date): string {
  return formatDate(new Date(card.year, card.month - 1, card.day), card.year !== now.getFullYear() ? "medium" : "dayMonth")
}

/** How many songs the card lists before "See all": the whole short list when the festival has no page of its own to open. */
export function cardPreviewSongs(card: TodayFestivalCard, withPage = 3, withoutPage = 5): FestivalSongLink[] {
  return card.songs.all.slice(0, card.pageId ? withPage : withoutPage)
}
