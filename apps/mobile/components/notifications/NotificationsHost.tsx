import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"
import { usePathname, useRouter } from "expo-router"

import { PREVIEW_SONG_PICKS } from "@/lib/fixtures/notifications"
import { learningStreak } from "@/lib/learn/streak"
import { learnWordsAvailable } from "@/lib/learn/verified"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { nowMs } from "@/lib/notifications/clock"
import {
  applySchedule,
  cancelAll,
  configureNotifications,
  dismissStalePresented,
  listenForTaps,
  nativeNotificationsAvailable,
  setBadge,
} from "@/lib/notifications/native"
import { ensurePermission, refreshPermission, shouldAskInContext } from "@/lib/notifications/permission"
import { badgeCount } from "@/lib/notifications/retention"
import { usePreferencesStore } from "@/stores/preferencesStore"
import {
  firedSince,
  scheduleAhead,
  startOfDay,
  toInboxItem,
  type PlanInput,
  type SongPick,
  type TodaySong,
} from "@/lib/notifications/schedule"
import { FESTIVAL_ENTRIES, readSongPicks, readTodaySong, resolveForOpen } from "@/lib/notifications/sources"
import { useLearnStore } from "@/stores/learnStore"
import { useNotificationHealthStore } from "@/stores/notificationHealthStore"
import { useNotificationSettingsStore } from "@/stores/notificationSettingsStore"
import { useNotificationsStore } from "@/stores/notificationsStore"
import { href } from "@/utils/href"
import { PushRegistration } from "@/components/notifications/PushRegistration"
import { ReplyNoticeSync } from "@/components/notifications/ReplyNoticeSync"
import { useLanguage } from "@/lib/i18n"

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

const STORES: readonly Persisted[] = [useNotificationSettingsStore, useNotificationsStore, useLearnStore]

/**
 * Keeps the reminders and the inbox in step with the app. Mount it once in the root layout; it draws
 * nothing. It runs on start, when the app comes to the front, and when a setting, the
 * word cards or the song list change:
 * - the inbox takes in what has fired (lib/notifications/schedule.ts `firedSince`),
 * - the phone's scheduled notifications are made equal to the plan ahead (`scheduleAhead`: songs and festivals up to 30 days, the rest 7), only
 *   when the OS permission is granted (it never asks here),
 * - the badge becomes the unread count,
 * - a tap on a notification opens its screen.
 * On the web preview the native calls do nothing and only the inbox is filled.
 */
export function NotificationsHost() {
  const router = useRouter()
  const hydrated = useHydrated(STORES)
  const [songs, setSongs] = useState<readonly SongPick[]>(MOCKUP_DATA ? PREVIEW_SONG_PICKS : [])

  const master = useNotificationSettingsStore((s) => s.master)
  const song = useNotificationSettingsStore((s) => s.song)
  const festival = useNotificationSettingsStore((s) => s.festival)
  const words = useNotificationSettingsStore((s) => s.words)
  const streakOn = useNotificationSettingsStore((s) => s.streak)
  const permission = useNotificationSettingsStore((s) => s.permission)
  const cards = useLearnStore((s) => s.cards)
  // "Try again" in the centre
  const retryTick = useNotificationHealthStore((s) => s.retryTick)
  // reminders carry text: when the language changes, the pending ones are planned again in the new one
  const language = useLanguage()

  const sources = useRef<{ songs: readonly SongPick[]; todaySong: TodaySong | null }>({ songs, todaySong: null })
  sources.current.songs = songs

  const input = useCallback((now: number): PlanInput => {
    const st = useNotificationSettingsStore.getState()
    const learn = useLearnStore.getState()
    return {
      now,
      settings: { master: st.master, song: st.song, festival: st.festival, words: st.words, streak: st.streak },
      songs: sources.current.songs,
      todaySong: sources.current.todaySong,
      festivals: FESTIVAL_ENTRIES,
      // word cards are unchecked prototype content in a real build: no "words are due" or streak reminders from them
      cards: learnWordsAvailable() ? learn.cards : {},
      streak: learningStreak(learnWordsAvailable() ? learn.cards : {}, now),
    }
  }, [])

  /**
   * Put what has fired in the inbox. Cheap, no native calls. On a phone the bell lists only what the phone
   * was told to deliver (the ledger kept at the last scheduling) and only while the OS permission is
   * granted: a reminder that never arrived does not appear. The preview has no phone, so there the inbox
   * is filled from the plan.
   */
  const syncInbox = useCallback(() => {
    const now = nowMs()
    const inbox = useNotificationsStore.getState()
    const since = MOCKUP_DATA ? now - PREVIEW_BACKFILL_DAYS * DAY_MS : (inbox.syncedAt ?? startOfDay(now))
    if (nativeNotificationsAvailable && !MOCKUP_DATA) {
      const settings = useNotificationSettingsStore.getState()
      const delivered =
        settings.master && settings.permission === "granted"
          ? inbox.scheduled.filter((n) => n.fireAt > since && n.fireAt <= now).map(toInboxItem)
          : []
      inbox.receive(delivered, now)
      return
    }
    inbox.receive(firedSince(input(now), since).map(toInboxItem), now)
  }, [input])

  /** Take read and stale notifications off the lock screen and out of the shade. */
  const tidyShade = useCallback(async () => {
    if (!nativeNotificationsAvailable) return
    const read = new Set(useNotificationsStore.getState().read)
    await dismissStalePresented((id) => read.has(id), nowMs())
  }, [])

  /** Make the phone's schedule equal the plan, and set the badge. */
  const reschedule = useCallback(async () => {
    // the permission first: the inbox must not take in reminders from a time when the OS no longer allowed them
    const granted = nativeNotificationsAvailable ? (await refreshPermission()) === "granted" : false
    syncInbox()
    if (!nativeNotificationsAvailable) return
    sources.current.todaySong = await readTodaySong()
    const now = nowMs()
    const st = useNotificationSettingsStore.getState()
    if (granted && st.master) {
      useNotificationsStore.getState().setScheduled(await applySchedule(scheduleAhead(input(now))))
    } else {
      await cancelAll()
      useNotificationsStore.getState().setScheduled([])
    }
    const inbox = useNotificationsStore.getState()
    // master off or no permission: no number on the icon either
    await setBadge(granted && st.master ? badgeCount(inbox.items, inbox.read, nowMs()) : 0)
    await tidyShade()
  }, [input, syncInbox])

  // ask for the OS permission in context: when the first song or word is saved, not at launch
  const savedCount = usePreferencesStore((s) => s.savedSongIds.length)
  const cardCount = useLearnStore((s) => Object.keys(s.cards).length)
  const previousCount = useRef<number | null>(null)
  useEffect(() => {
    if (!hydrated) return
    const total = savedCount + cardCount
    const previous = previousCount.current
    previousCount.current = total
    if (shouldAskInContext({ previous, total, permission, master })) void ensurePermission()
  }, [hydrated, savedCount, cardCount, permission, master])

  // the icon badge follows the unread count at once (Read all, opening one), not at the next reschedule
  const unread = useNotificationsStore((s) => (master && permission !== "denied" ? badgeCount(s.items, s.read, nowMs()) : 0))
  const readCount = useNotificationsStore((s) => s.read.length)
  useEffect(() => {
    if (!hydrated || !nativeNotificationsAvailable) return
    void setBadge(unread)
  }, [hydrated, unread])

  // a notification opened or marked read in the app also leaves the lock screen
  useEffect(() => {
    if (hydrated) void tidyShade()
  }, [hydrated, readCount, tidyShade])

  // the Android channel name is in the app language; calling again renames it
  useEffect(() => {
    void configureNotifications(language)
  }, [language])

  useEffect(() => {
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
  }, [hydrated, reschedule, master, song, festival, words, streakOn, permission, cards, songs, language, retryTick])

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

  // A tap opens the notification's screen and marks it read. When the tap started the app, the start screen
  // ("/") is still redirecting to Today or Welcome: the target waits in `pendingTarget` and opens once the
  // app is on a real screen, so the two navigations never race (and the tap never opens twice).
  const pathname = usePathname()
  const booted = pathname !== "/" && pathname !== ""
  const pendingTarget = useRef<{ target: string; kind: string } | null>(null)
  const openTarget = useCallback(
    (target: string, kind: string) => {
      // a notification can outlive what it points at: a missing song or festival opens the kind's list instead
      void resolveForOpen({ kind, target }).then((resolved) => {
        try {
          router.push(href(resolved.route))
        } catch {
          /* the navigator was not ready; the inbox still has the item */
        }
      })
    },
    [router],
  )
  const bootedRef = useRef(booted)
  bootedRef.current = booted

  useEffect(() => {
    if (!hydrated) return
    return listenForTaps(({ id, target, kind }) => {
      if (id) useNotificationsStore.getState().open(id)
      if (bootedRef.current) setTimeout(() => openTarget(target, kind), 150)
      else pendingTarget.current = { target, kind }
    })
  }, [hydrated, openTarget])

  useEffect(() => {
    if (!booted || !pendingTarget.current) return
    const timer = setTimeout(() => {
      const pending = pendingTarget.current
      pendingTarget.current = null
      if (pending) openTarget(pending.target, pending.kind)
    }, 300)
    return () => clearTimeout(timer)
  }, [booted, openTarget])

  // replies to the member's comments come from the server's notices; push (off unless the build says so) wakes the phone
  return (
    <>
      <ReplyNoticeSync />
      <PushRegistration />
    </>
  )
}
