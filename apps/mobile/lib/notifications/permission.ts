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
