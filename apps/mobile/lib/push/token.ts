import Constants from "expo-constants"
import { Platform } from "react-native"

/**
 * The Expo push token of this phone. Only called when the OS permission is already granted (this file never asks),
 * and only on a phone. The project id is the EAS project's (`extra.eas.projectId` of app.config.js). Returns null on
 * any problem: no module, no project id, no permission, a simulator, no network.
 */
type Expo = typeof import("expo-notifications")

export function easProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined
  const fromExtra = extra?.eas?.projectId
  if (typeof fromExtra === "string" && fromExtra.trim()) return fromExtra.trim()
  const fromEas = (Constants as unknown as { easConfig?: { projectId?: unknown } }).easConfig?.projectId
  return typeof fromEas === "string" && fromEas.trim() ? fromEas.trim() : null
}

export async function readExpoPushToken(): Promise<string | null> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null
  try {
    const N = require("expo-notifications") as Expo
    const permission = await N.getPermissionsAsync()
    if (!permission.granted && permission.status !== "granted") return null
    const projectId = easProjectId()
    if (!projectId) return null
    const token = await N.getExpoPushTokenAsync({ projectId })
    return typeof token.data === "string" && token.data ? token.data : null
  } catch {
    return null
  }
}
