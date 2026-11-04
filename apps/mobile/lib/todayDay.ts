import type { TodayRecommendations } from "@prabhat/core"

/**
 * What kind of day Today is (prototype `DAYS`, Main.dc.html around line 2950):
 * - date: the songs Bábá gave on this calendar day
 * - fest: a festival falls today and its songs replace the daily ones
 * - season: the songs of the season of the year
 * Pure logic, no React.
 */
export type TodayDayKind = "date" | "fest" | "season"

export type TodayDay = {
  kind: TodayDayKind
  /** "Sunday · 1 November" (the screen prints it in capitals) */
  dateLabel: string
  /** text of the coloured chip under the date */
  kindLabel: string
  /** one sentence under the heading; empty on an ordinary day */
  note: string
  /** small tag on the photograph */
  tag: string
  /** label of the extra "also composed on" card, or null */
  alsoLabel: string | null
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

/** "Sunday · 1 November". */
export function formatDayLine(now: Date): string {
  return `${WEEKDAYS[now.getDay()]} · ${now.getDate()} ${MONTHS[now.getMonth()]}`
}

function clean(value: string | null | undefined): string {
  return (value ?? "").trim()
}

/**
 * The day from the API context. A festival wins; "season" is used only when the API says the
 * recommendations are seasonal; every other day is "Composed on this day".
 */
export function buildTodayDay(today: TodayRecommendations | null | undefined, now: Date): TodayDay {
  const dateLabel = formatDayLine(now)
  const context = today?.context
  const festival = clean(context?.festival) || clean(context?.observance)
  const mode = clean(context?.recommendation_mode)

  if (festival || mode === "strict_festival") {
    const name = festival || "Festival"
    return {
      kind: "fest",
      dateLabel,
      kindLabel: `Festival today · ${name}`,
      note: "These songs belong to this day.",
      tag: `For ${name}`,
      alsoLabel: `Also composed on ${now.getDate()} ${MONTHS[now.getMonth()]}`,
    }
  }
  const season = clean(context?.season)
  if (season && /season/i.test(mode)) {
    return {
      kind: "season",
      dateLabel,
      kindLabel: `Season now · ${season}`,
      note: "These songs belong to this time of the year.",
      tag: "For this season",
      alsoLabel: `Also composed on ${now.getDate()} ${MONTHS[now.getMonth()]}`,
    }
  }
  return {
    kind: "date",
    dateLabel,
    kindLabel: "Composed on this day",
    note: "",
    tag: "Song of the day",
    alsoLabel: null,
  }
}

/** "1:12 of 5:00" for the resume card; just the number when the length is unknown. */
export function resumeLine(input: { number: number | string; position: number; duration: number }): string {
  const head = `PS ${input.number}`
  if (!(input.duration > 0) || !(input.position > 0)) return head
  const clock = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
  }
  return `${head} · ${clock(input.position)} of ${clock(input.duration)}`
}

/** The three ways to search on Today (prototype `quick`): each opens search with an example. */
export const TODAY_QUICK_SEARCHES = [
  { id: "number", label: "Number", example: "3", query: "3" },
  { id: "words", label: "Words", example: "bandhu he niye calo", query: "bandhu" },
  { id: "feeling", label: "Feeling", example: "peaceful devotion", query: "peaceful devotion" },
] as const

export const TODAY_QUICK_INTRO =
  "Three ways to search. Tap one to open search with an example: a song number, words from the lyrics, or a feeling."

/** Search route that opens with the query filled in. */
export function searchHref(query: string): string {
  return `/search-v2?q=${encodeURIComponent(query)}`
}
