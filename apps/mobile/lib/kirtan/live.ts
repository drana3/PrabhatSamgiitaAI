/**
 * Live broadcasts of Kiirtans (the team streams them on YouTube Live or Zoom). A broadcast is a live
 * stream, not a track: it never enters the player's queue or the mini-player; it opens its own screen.
 * Pure helpers, no React, no stores. Times are local to the phone.
 * TODO(api): the schedule comes from the backend; today it is the preview fixtures (lib/fixtures/kirtanLive.ts).
 */

export type LivePlatform = "youtube" | "zoom"
export type LiveStatus = "live" | "upcoming" | "ended"

export type LiveItem = {
  id: string
  title: string
  /** who hosts it: "Delhi group", "Group D" */
  host: string
  platform: LivePlatform
  /** ms since epoch */
  startsAt: number
  /** minutes; a broadcast counts as live until startsAt + durationMin */
  durationMin: number
  /** as the server last said; "ended" is final, the other two are re-derived from the clock */
  status: LiveStatus
  /** YouTube Live video id (placeholder until the backend gives the real one) */
  youtubeId?: string
  zoom?: { url: string; meetingId: string; passcode: string }
}

export const LIVE_PLATFORM_LABEL: Record<LivePlatform, string> = { youtube: "YouTube", zoom: "Zoom" }

/** Live now, upcoming, or ended, from the clock. A broadcast the server closed stays ended. */
export function liveStatus(item: Pick<LiveItem, "startsAt" | "durationMin" | "status">, now: number): LiveStatus {
  if (item.status === "ended") return "ended"
  if (now < item.startsAt) return "upcoming"
  return now < item.startsAt + item.durationMin * 60_000 ? "live" : "ended"
}

/** What the shelf shows: ended ones are dropped, live first, then by start time (ties keep the given order). */
export function visibleLive<T extends Pick<LiveItem, "startsAt" | "durationMin" | "status">>(items: readonly T[], now: number): T[] {
  return items
    .map((item, index) => ({ item, index, status: liveStatus(item, now) }))
    .filter((x) => x.status !== "ended")
    .sort((a, b) => Number(b.status === "live") - Number(a.status === "live") || a.item.startsAt - b.item.startsAt || a.index - b.index)
    .map((x) => x.item)
}

/** The broadcast that is on right now, the earliest started if several. */
export function liveNow<T extends Pick<LiveItem, "startsAt" | "durationMin" | "status">>(items: readonly T[], now: number): T | null {
  return visibleLive(items, now).find((item) => liveStatus(item, now) === "live") ?? null
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const

function dayStart(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** `18:30`, `6:00`: 24-hour clock, no zero before the hour. */
export function clockLabel(ms: number): string {
  const d = new Date(ms)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** `Today 18:30`, `Tomorrow 6:00`, `Sat 6:00` (within a week), `12 Nov 18:30` (later). */
export function whenLabel(startsAt: number, now: number): string {
  const days = Math.round((dayStart(startsAt) - dayStart(now)) / 86_400_000)
  const clock = clockLabel(startsAt)
  if (days <= 0) return `Today ${clock}`
  if (days === 1) return `Tomorrow ${clock}`
  if (days < 7) return `${WEEKDAYS[new Date(startsAt).getDay()]} ${clock}`
  const d = new Date(startsAt)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${clock}`
}

/** `Delhi group · YouTube`. */
export function hostLine(item: Pick<LiveItem, "host" | "platform">): string {
  const platform = LIVE_PLATFORM_LABEL[item.platform]
  return item.host.trim() ? `${item.host.trim()} · ${platform}` : platform
}

/** Badge text of a card: `LIVE` or the start time. */
export function liveBadge(item: Pick<LiveItem, "startsAt" | "durationMin" | "status">, now: number): string {
  return liveStatus(item, now) === "live" ? "LIVE" : whenLabel(item.startsAt, now)
}

/** The official YouTube IFrame embed address. Nothing is downloaded or extracted. */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube.com/embed/${encodeURIComponent(id)}?playsinline=1&rel=0`
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`
}

/** The text a share carries (link text; the site has no page per broadcast yet). */
export function liveShareMessage(item: Pick<LiveItem, "title" | "host" | "platform" | "startsAt" | "durationMin" | "status">, now: number, url: string): string {
  const when = liveStatus(item, now) === "live" ? "live now" : whenLabel(item.startsAt, now)
  return `Kiirtan live: ${item.title}, ${when}, ${hostLine(item)}.\n${url}`
}
