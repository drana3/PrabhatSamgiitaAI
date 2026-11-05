import type { LiveItem } from "@/lib/kirtan/live"

/**
 * Sample live broadcasts, built around `now` so the preview always has one live now and three coming.
 * TODO(api): the schedule, the YouTube Live ids and the Zoom meetings come from the backend. The ids,
 * meeting numbers and passcodes here are placeholders, not real rooms. Names of groups are made up.
 */
const MIN = 60_000

/** The next `hour:minute` local time after `from` (today if still ahead, else tomorrow). */
function nextAt(from: number, hour: number, minute: number): number {
  const d = new Date(from)
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute).getTime()
  return t > from ? t : new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, hour, minute).getTime()
}

/** The next given weekday (0 Sunday to 6 Saturday), at least two days ahead, at `hour:minute`. */
function nextWeekday(from: number, weekday: number, hour: number, minute: number): number {
  const d = new Date(from)
  let add = (weekday - d.getDay() + 7) % 7
  if (add < 2) add += 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + add, hour, minute).getTime()
}

export function liveFixtures(now: number): LiveItem[] {
  return [
    {
      id: "live-delhi-evening",
      title: "Evening dharmacakra kiirtan",
      host: "Delhi group",
      platform: "youtube",
      startsAt: now - 25 * MIN,
      durationMin: 120,
      status: "live",
      youtubeId: "M7lc1UVf-VE", // TODO(api): placeholder id
    },
    {
      id: "live-groupd-zoom",
      title: "Baba Nam Kevalam, one hour together",
      host: "Group D",
      platform: "zoom",
      startsAt: nextAt(now + 90 * MIN, 18, 30),
      durationMin: 60,
      status: "upcoming",
      zoom: { url: "https://zoom.us/j/84012345678?pwd=placeholder", meetingId: "840 1234 5678", passcode: "108108" }, // TODO(api): placeholder room
    },
    {
      id: "live-sunrise-youtube",
      title: "Sunrise kiirtan for the new week",
      host: "Pune sadhakas",
      platform: "youtube",
      startsAt: nextAt(now, 6, 0),
      durationMin: 75,
      status: "upcoming",
      youtubeId: "M7lc1UVf-VE", // TODO(api): placeholder id
    },
    {
      id: "live-night-zoom",
      title: "Night kiirtan for long meditation",
      host: "Group A",
      platform: "zoom",
      startsAt: nextWeekday(now, 6, 6, 0),
      durationMin: 90,
      status: "upcoming",
      zoom: { url: "https://zoom.us/j/84098765432?pwd=placeholder", meetingId: "840 9876 5432", passcode: "216216" }, // TODO(api): placeholder room
    },
  ]
}
