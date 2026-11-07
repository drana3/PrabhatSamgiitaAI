import { Linking, Platform } from "react-native"

import { getActiveLanguage, type Language } from "@/lib/i18n/core"
import { channelGroupName, channelName, privatePreviewText } from "@/lib/notifications/channelNames"
import { channelFor, nativeContent } from "@/lib/notifications/content"
import { CHANNELS, CHANNEL_GROUPS, KIND_META, categoryOf, isImportant, type ChannelGroupId, type NotificationKind } from "@/lib/notifications/kinds"
import { STALE_PRESENTED_HOURS } from "@/lib/notifications/retention"
import { capForPlatform, diffSchedule, type PlannedNotification } from "@/lib/notifications/schedule"
import { useNotificationHealthStore } from "@/stores/notificationHealthStore"

/**
 * The only file that talks to `expo-notifications`. On the web preview (react-native-web) and wherever
 * the native module is missing, every function here is a no-op that resolves to a harmless value, so
 * no screen has to check the platform. Permission is asked only by `askPermission`, which the UI calls
 * when the person turns something on; nothing in this file asks on its own.
 */

type Expo = typeof import("expo-notifications")

/** Android channel of every reminder. */
export const REMINDERS_CHANNEL = "reminders"

export const nativeNotificationsAvailable: boolean = Platform.OS === "ios" || Platform.OS === "android"

let cached: Expo | null | undefined
function expo(): Expo | null {
  if (!nativeNotificationsAvailable) return null
  if (cached === undefined) {
    try {
      cached = require("expo-notifications") as Expo
    } catch {
      cached = null
    }
  }
  return cached
}

export type OsPermission = "granted" | "denied" | "undetermined"

function toPermission(res: { granted: boolean; canAskAgain: boolean; status: string }): OsPermission {
  if (res.granted || res.status === "granted") return "granted"
  return res.status === "undetermined" ? "undetermined" : "denied"
}

/**
 * Foreground banner (no sound while the app is open), the Android channels and their groups, and the iOS
 * categories, named in the app language (calling again renames them). Safe to call more than once.
 * Android: one channel per class of notification (kinds.ts CHANNELS) so each can be muted on its own in system
 * settings; the channel id `reminders` is the original one and keeps the person's own choices. iOS: a category
 * `ps.<kind>` for every important kind, with a private preview so the lock screen can hide the text.
 */
export async function configureNotifications(language: Language = getActiveLanguage()): Promise<void> {
  const N = expo()
  if (!N) return
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    })
  } catch {
    /* a missing handler only costs the foreground banner */
  }
  if (Platform.OS === "android") {
    try {
      for (const group of CHANNEL_GROUPS) {
        await N.setNotificationChannelGroupAsync?.(group satisfies ChannelGroupId, { name: channelGroupName(group, language) })
      }
      for (const channel of Object.values(CHANNELS)) {
        await N.setNotificationChannelAsync(channel.id, {
          name: channelName(channel.id, language),
          importance: channel.importance === "high" ? N.AndroidImportance.HIGH : N.AndroidImportance.DEFAULT,
          showBadge: true,
          groupId: channel.group,
          lightColor: "#B94D0C",
          // a notice about the person's own upload hides its text on a secured lock screen
          lockscreenVisibility: channel.id === "notices" ? N.AndroidNotificationVisibility.PRIVATE : N.AndroidNotificationVisibility.PUBLIC,
        })
      }
    } catch {
      /* a missing channel is not worth failing the app for */
    }
  }
  if (Platform.OS === "ios") {
    try {
      for (const kind of Object.keys(KIND_META) as NotificationKind[]) {
        if (!isImportant(kind)) continue
        await N.setNotificationCategoryAsync(categoryOf(kind), [], { previewPlaceholder: privatePreviewText(language) })
      }
    } catch {
      /* categories only change the lock-screen text of notices */
    }
  }
}

/** The permission as the OS has it now. Never asks. */
export async function readPermission(): Promise<OsPermission> {
  const N = expo()
  if (!N) return "denied"
  try {
    return toPermission(await N.getPermissionsAsync())
  } catch {
    return "denied"
  }
}

/** Ask the OS. Call it only when the person turns a reminder on. */
export async function askPermission(): Promise<OsPermission> {
  const N = expo()
  if (!N) return "denied"
  try {
    const current = await N.getPermissionsAsync()
    if (current.granted) return "granted"
    if (!current.canAskAgain) return "denied"
    const asked = await N.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } })
    return asked.granted ? "granted" : asked.canAskAgain ? "undetermined" : "denied"
  } catch {
    return "denied"
  }
}

/** Open this app's page in the system settings (the only way back once the OS stopped asking). */
export function openSystemSettings(): void {
  void Linking.openSettings().catch(() => undefined)
}

/**
 * Make the phone's scheduled notifications equal the plan: cancel what is no longer planned (a time the
 * person moved or removed has another id, so its old notification is cancelled), schedule the rest under
 * their deterministic ids (an existing id is replaced). Only the soonest `MAX_PENDING` are scheduled: iOS
 * holds 64 at most. Returns the notifications the phone accepted: the inbox lists only those, because only
 * those can reach the person.
 */
export async function applySchedule(planned: readonly PlannedNotification[]): Promise<PlannedNotification[]> {
  const N = expo()
  if (!N) return []
  const accepted: PlannedNotification[] = []
  let failed = false
  try {
    const existing = await N.getAllScheduledNotificationsAsync()
    const { cancel, schedule } = diffSchedule(existing.map((e) => e.identifier), capForPlatform(planned))
    await Promise.all(cancel.map((id) => N.cancelScheduledNotificationAsync(id)))
    for (const n of schedule) {
      try {
        await N.scheduleNotificationAsync({
          identifier: n.id,
          content: nativeContent(n),
          trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: n.fireAt, channelId: channelFor(n.kind) },
        })
        accepted.push(n)
      } catch {
        // one refused reminder must not stop the others
        failed = true
      }
    }
    return accepted
  } catch {
    failed = true
    return accepted
  } finally {
    useNotificationHealthStore.getState().setScheduleFailed(failed)
  }
}

/** Remove every scheduled notification (the permission was taken away, or the master switch is off). */
export async function cancelAll(): Promise<void> {
  const N = expo()
  if (!N) return
  try {
    await N.cancelAllScheduledNotificationsAsync()
  } catch {
    /* nothing to cancel */
  }
}

/**
 * Clear the lock screen and the shade of notifications the person no longer needs: the ones the app knows
 * are read (opened in the centre, or "Mark all read") and the ones delivered more than
 * STALE_PRESENTED_HOURS ago. Without this the system keeps every "Song of the day" until it is swiped away.
 * Returns how many were removed.
 */
export async function dismissStalePresented(isRead: (id: string) => boolean, now: number): Promise<number> {
  const N = expo()
  if (!N) return 0
  let removed = 0
  try {
    const shown = await N.getPresentedNotificationsAsync()
    for (const item of shown) {
      const data = item.request.content.data as { id?: unknown } | undefined
      const id = typeof data?.id === "string" ? data.id : null
      // `date` is seconds on some platforms and milliseconds on others
      const deliveredAt = item.date < 1e12 ? item.date * 1000 : item.date
      const old = now - deliveredAt > STALE_PRESENTED_HOURS * 3_600_000
      if ((id && isRead(id)) || old) {
        await N.dismissNotificationAsync(item.request.identifier)
        removed += 1
      }
    }
  } catch {
    /* nothing presented, or the platform cannot list them */
  }
  return removed
}

/** The number on the app icon. */
export async function setBadge(count: number): Promise<void> {
  const N = expo()
  if (!N) return
  try {
    await N.setBadgeCountAsync(Math.max(0, Math.floor(count)))
  } catch {
    /* badges are not allowed on every launcher */
  }
}

type Tap = { id: string | null; target: string; kind: string }

function tapOf(response: { notification: { request: { content: { data?: unknown } } } } | null | undefined): Tap | null {
  const data = response?.notification.request.content.data as { id?: unknown; target?: unknown; kind?: unknown } | undefined
  if (!data || typeof data.target !== "string" || !data.target.startsWith("/")) return null
  return { id: typeof data.id === "string" ? data.id : null, target: data.target, kind: typeof data.kind === "string" ? data.kind : "announcement" }
}

/**
 * Call `onTap` when a notification is tapped, also for the tap that started the app. Returns the
 * function that stops listening.
 */
export function listenForTaps(onTap: (tap: Tap) => void): () => void {
  const N = expo()
  if (!N) return () => undefined
  try {
    const sub = N.addNotificationResponseReceivedListener((response) => {
      const tap = tapOf(response)
      if (tap) onTap(tap)
    })
    // the tap that started the app
    const start = tapOf(N.getLastNotificationResponse())
    if (start) {
      onTap(start)
      // handled: a later listener (a re-mount, a hot reload) must not open the same screen again
      try {
        N.clearLastNotificationResponse?.()
      } catch {
        /* older runtime without it */
      }
    }
    return () => sub.remove()
  } catch {
    return () => undefined
  }
}
