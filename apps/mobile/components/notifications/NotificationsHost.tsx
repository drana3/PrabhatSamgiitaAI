import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"
import { useRouter } from "expo-router"

import { PREVIEW_SONG_PICKS } from "@/lib/fixtures/notifications"
import { useKirtanLive } from "@/hooks/useKirtanLive"
import { learningStreak } from "@/lib/learn/streak"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { unreadCount } from "@/lib/notifications"
import { nowMs } from "@/lib/notifications/clock"
import {
  applySchedule,
  cancelAll,
  configureNotifications,
  listenForTaps,
  nativeNotificationsAvailable,
  setBadge,
} from "@/lib/notifications/native"
import { ensurePermission, refreshPermission } from "@/lib/notifications/permission"
import {
  firedSince,
  scheduleNext7Days,
  startOfDay,
  toInboxItem,
  type PlanInput,
  type SongPick,
} from "@/lib/notifications/schedule"
import { FESTIVAL_ENTRIES, readSongPicks } from "@/lib/notifications/sources"
import { useKirtanLiveStore } from "@/stores/kirtanLiveStore"
import { useLearnStore } from "@/stores/learnStore"
import { useNotificationSettingsStore } from "@/stores/notificationSettingsStore"
import { useNotificationsStore } from "@/stores/notificationsStore"
import { href } from "@/utils/href"

const DAY_MS = 86_400_000
/** In the preview the inbox looks this far back, so Today and Earlier both have something to show. */
const PREVIEW_BACKFILL_DAYS = 3

type Persisted = { persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void } }

/** True once every saved store the scheduler reads has been loaded from the phone. */
function useHydrated(stores: readonly Persisted[]): boolean {
  const check = () => stores.every((s) => s.persist.hasHydrated())
  const [ready, setReady] = useState(check)
  useEffect(() => {
    if (check()) setReady(true)
    const offs = stores.map((s) => s.persist.onFinishHydration(() => check() && setReady(true)))
    return () => offs.forEach((off) => off())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return ready
}

const STORES: readonly Persisted[] = [useNotificationSettingsStore, useNotificationsStore, useLearnStore, useKirtanLiveStore]

/**
 * Keeps the reminders and the inbox in step with the app. Mount it once in the root layout; it draws
 * nothing. It runs on start, when the app comes to the front, and when a setting, a live reminder, the
 * word cards or the song list change:
 * - the inbox takes in what has fired (lib/notifications/schedule.ts `firedSince`),
 * - the phone's scheduled notifications are made equal to the next 7 days (`scheduleNext7Days`), only
 *   when the OS permission is granted (it never asks here),
 * - the badge becomes the unread count,
 * - a tap on a notification opens its screen.
 * On the web preview the native calls do nothing and only the inbox is filled.
 */
export function NotificationsHost() {
  const router = useRouter()
  const hydrated = useHydrated(STORES)
  const { all: live } = useKirtanLive()
  const [songs, setSongs] = useState<readonly SongPick[]>(MOCKUP_DATA ? PREVIEW_SONG_PICKS : [])

  const master = useNotificationSettingsStore((s) => s.master)
  const song = useNotificationSettingsStore((s) => s.song)
  const festival = useNotificationSettingsStore((s) => s.festival)
  const words = useNotificationSettingsStore((s) => s.words)
  const streakOn = useNotificationSettingsStore((s) => s.streak)
  const liveOn = useNotificationSettingsStore((s) => s.live)
  const quiet = useNotificationSettingsStore((s) => s.quiet)
  const permission = useNotificationSettingsStore((s) => s.permission)
  const cards = useLearnStore((s) => s.cards)
  const remindIds = useKirtanLiveStore((s) => s.remindIds)

  const sources = useRef({ live, songs })
  sources.current = { live, songs }

  const input = useCallback((now: number): PlanInput => {
    const st = useNotificationSettingsStore.getState()
    const learn = useLearnStore.getState()
    return {
      now,
      settings: { master: st.master, song: st.song, festival: st.festival, words: st.words, streak: st.streak, live: st.live, quiet: st.quiet },
      songs: sources.current.songs,
      festivals: FESTIVAL_ENTRIES,
      cards: learn.cards,
      streak: learningStreak(learn.cards, now),
      live: sources.current.live,
      remindIds: useKirtanLiveStore.getState().remindIds,
    }
  }, [])

  /** Put what has fired in the inbox. Cheap, no native calls. */
  const syncInbox = useCallback(() => {
    const now = nowMs()
    const inbox = useNotificationsStore.getState()
    const since = MOCKUP_DATA ? now - PREVIEW_BACKFILL_DAYS * DAY_MS : (inbox.syncedAt ?? startOfDay(now))
    inbox.receive(firedSince(input(now), since).map(toInboxItem), now)
  }, [input])

  /** Make the phone's schedule equal the plan, and set the badge. */
  const reschedule = useCallback(async () => {
    syncInbox()
    if (!nativeNotificationsAvailable) return
    const now = nowMs()
    const granted = (await refreshPermission()) === "granted"
    const st = useNotificationSettingsStore.getState()
    if (granted && st.master) await applySchedule(scheduleNext7Days(input(now)))
    else await cancelAll()
    const inbox = useNotificationsStore.getState()
    await setBadge(unreadCount(inbox.items, inbox.read))
  }, [input, syncInbox])

  useEffect(() => {
    void configureNotifications()
    if (MOCKUP_DATA) return
    let alive = true
    void readSongPicks().then((picks) => alive && setSongs(picks))
    return () => {
      alive = false
    }
  }, [])

  // the preview has no real learner: put in the prototype's sample words, once, so "words are due" is real
  useEffect(() => {
    if (hydrated && MOCKUP_DATA) useLearnStore.getState().seedDemo()
  }, [hydrated])

  // everything that changes the plan: debounce, then reschedule
  useEffect(() => {
    if (!hydrated) return
    const timer = setTimeout(() => void reschedule(), 400)
    return () => clearTimeout(timer)
  }, [hydrated, reschedule, master, song, festival, words, streakOn, liveOn, quiet, permission, cards, remindIds, live, songs])

  // back to the front: look again; while it is in front, keep the inbox current
  useEffect(() => {
    if (!hydrated) return
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void reschedule()
    })
    const tick = setInterval(() => AppState.currentState === "active" && syncInbox(), 60_000)
    return () => {
      sub.remove()
      clearInterval(tick)
    }
  }, [hydrated, reschedule, syncInbox])

  // the first reminder for a live Kiirtan is the moment to ask for permission (never at launch)
  const knownReminders = useRef<readonly string[] | null>(null)
  useEffect(() => {
    if (!hydrated) return
    const before = knownReminders.current
    knownReminders.current = remindIds
    if (before && remindIds.some((id) => !before.includes(id))) void ensurePermission()
  }, [hydrated, remindIds])

  // a tap opens the notification's screen and marks it read
  useEffect(() => {
    if (!hydrated) return
    return listenForTaps(({ id, target }) => {
      if (id) useNotificationsStore.getState().open(id)
      setTimeout(() => {
        try {
          router.push(href(target))
        } catch {
          /* the navigator was not ready; the inbox still has the item */
        }
      }, 300)
    })
  }, [hydrated, router])

  return null
}
