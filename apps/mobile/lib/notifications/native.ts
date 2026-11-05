import { Linking, Platform } from "react-native"

import { diffSchedule, type PlannedNotification } from "@/lib/notifications/schedule"

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

/** Foreground banner and the Android channel. Safe to call more than once. */
export async function configureNotifications(): Promise<void> {
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
    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync(REMINDERS_CHANNEL, {
        name: "Reminders",
        importance: N.AndroidImportance.DEFAULT,
        showBadge: true,
      })
    }
  } catch {
    /* a missing channel is not worth failing the app for */
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

/** Ask the OS. Call it only when the person turns a reminder on (or sets the first live reminder). */
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
 * Make the phone's scheduled notifications equal the plan: cancel what is no longer planned, schedule the
 * rest under their deterministic ids (an existing id is replaced). Returns how many are scheduled.
 */
export async function applySchedule(planned: readonly PlannedNotification[]): Promise<number> {
  const N = expo()
  if (!N) return 0
  try {
    const existing = await N.getAllScheduledNotificationsAsync()
    const { cancel, schedule } = diffSchedule(existing.map((e) => e.identifier), planned)
    await Promise.all(cancel.map((id) => N.cancelScheduledNotificationAsync(id)))
    for (const n of schedule) {
      await N.scheduleNotificationAsync({
        identifier: n.id,
        content: { title: n.title, body: n.text, data: { id: n.id, target: n.target }, sound: false },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: n.fireAt, channelId: REMINDERS_CHANNEL },
      })
    }
    return schedule.length
  } catch {
    return 0
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

type Tap = { id: string | null; target: string }

function tapOf(response: { notification: { request: { content: { data?: unknown } } } } | null | undefined): Tap | null {
  const data = response?.notification.request.content.data as { id?: unknown; target?: unknown } | undefined
  if (!data || typeof data.target !== "string" || !data.target.startsWith("/")) return null
  return { id: typeof data.id === "string" ? data.id : null, target: data.target }
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
    if (start) onTap(start)
    return () => sub.remove()
  } catch {
    return () => undefined
  }
}
