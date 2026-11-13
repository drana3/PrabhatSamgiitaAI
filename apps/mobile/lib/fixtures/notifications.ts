import type { AppNotification } from "@/lib/notifications"
import { announcementNotification, replyNotification, uploadDecisionNotification } from "@/lib/notifications/serverKinds"
import type { SongPick } from "@/lib/notifications/schedule"

/**
 * Preview only (MOCKUP_DATA). The inbox in the preview is filled by the real scheduler (song of the
 * day, festival eve, words, live reminders). These are the kinds that have no local trigger yet.
 * TODO(api): story, upload and announcement items arrive from the server (docs/notifications.md).
 */

const DAY = 86_400_000

function at(now: number, daysAgo: number, hour: number, minute = 0): number {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysAgo, hour, minute).getTime()
}

export function inboxFixtures(now: number): AppNotification[] {
  const all: AppNotification[] = [
    {
      id: "n-story",
      kind: "story",
      title: "New story",
      text: "The story behind PS 1 is ready to read.",
      target: "/story-sheet/mock-story-0",
      firedAt: at(now, 1, 16, 10),
    },
    uploadDecisionNotification({ uploadId: "k-sunrise", title: "Sunrise Kiirtan", decision: "removed", reason: "It is a commercial recording we cannot share without the label's permission.", firedAt: at(now, 2, 11, 40) }),
    announcementNotification({
      announcementId: "a-festival-songs",
      title: "From the team",
      text: "New festival songs are in the library.",
      target: "/songs-v2-collection?id=festival&title=Festivals",
      firedAt: at(now, 4, 9, 0),
    }),
    // replies to the member's comments: three under one comment fold into one row, one stands alone
    ...[
      { id: "r1", from: "Bhakti", hour: 9, minute: 5 },
      { id: "r2", from: null, hour: 10, minute: 20 },
      { id: "r3", from: "Karuna", hour: 11, minute: 45 },
    ].map((r) => replyNotification({ noticeId: r.id, from: r.from, songNumber: 3, parentId: "mock-3-1", firedAt: at(now, 1, r.hour, r.minute) })),
    replyNotification({ noticeId: "r4", from: "Madhu", songNumber: 7, parentId: "mock-7-1", firedAt: at(now, 2, 18, 30) }),
  ].filter((n): n is AppNotification => n !== null)
  return all.filter((n) => n.firedAt <= now && n.firedAt > now - 30 * DAY)
}

/**
 * Songs the preview scheduler can pick from. The composition dates are made up for the preview (there
 * is no composition-date source in the app yet); PS 3 is "composed" on 5 November so the text shows.
 * TODO(api): the real "composed on this day" comes from the backend's song-of-the-day signal.
 */
export const PREVIEW_SONG_PICKS: readonly SongPick[] = [
  { number: 3, title: "Ándhára Sheśe Álora Deshe", composed: { month: 11, day: 5, year: 1983 } },
  { number: 1, title: "Bandhu He Niye Calo", composed: { month: 11, day: 3, year: 1982 } },
  { number: 5, title: "Elo, Anek Juger Sei Ajáná Pathik" },
  { number: 2, title: "E Gán Ámár, Álor Jharańá Dhárá" },
  { number: 4, title: "Sakal Maner Viińá Ek Sure Báje Áj" },
  { number: 6, title: "Bandhu Ámár" },
  { number: 7, title: "Niiravatá Májhe Ke Go Tumi Ele" },
]
