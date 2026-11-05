import { askPermission, nativeNotificationsAvailable, readPermission, type OsPermission } from "@/lib/notifications/native"
import { useNotificationSettingsStore } from "@/stores/notificationSettingsStore"

/**
 * Ask the OS for permission and remember the answer. Called when the person turns a reminder on;
 * never at launch. A no-op on the web preview.
 */
export async function ensurePermission(): Promise<OsPermission> {
  if (!nativeNotificationsAvailable) return "denied"
  const answer = await askPermission()
  useNotificationSettingsStore.getState().setPermission(answer)
  return answer
}

/** Read the OS permission without asking and remember it. */
export async function refreshPermission(): Promise<OsPermission> {
  if (!nativeNotificationsAvailable) return "denied"
  const answer = await readPermission()
  useNotificationSettingsStore.getState().setPermission(answer)
  return answer
}

/**
 * The moment to ask: right after the person gave the app something to remind them about, their first
 * saved song or word card, while the OS has never been asked. Settings show "On" by default, so without
 * this the reminders would never come until someone opened Notification settings.
 * `previous` is the count of saved songs plus cards before the change (null before the first reading).
 */
export function shouldAskInContext(input: {
  previous: number | null
  total: number
  permission: "unknown" | "granted" | "denied" | "undetermined"
  master: boolean
}): boolean {
  if (input.previous == null || !input.master) return false
  return input.permission === "undetermined" && input.total > input.previous
}
