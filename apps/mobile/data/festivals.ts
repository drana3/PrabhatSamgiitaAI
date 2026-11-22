export type {
  FestivalListItem,
  FestivalObservance as UpcomingFestival,
} from "@prabhat/core"
export {
  LATEST_REVIEWED_FESTIVAL_YEAR,
  REVIEWED_FESTIVAL_YEAR,
  festivalCalendar2026,
  festivalCalendar2027,
  festivalCalendarExhausted,
  getFestivalById,
  getUpcomingFestivals,
} from "@prabhat/core"

/** Legacy alias — mobile home “today” context block. */
export const todayContext = {
  modeLabel: "Daily reflection",
  reason: "Selected for today’s quiet devotion and seasonal mood.",
  observance: null as string | null,
}