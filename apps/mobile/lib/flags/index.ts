import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"
import { useSyncExternalStore } from "react"
import { Platform } from "react-native"

import { track } from "@/lib/analytics"
import { getInstallId } from "@/lib/analytics/installId"
import { apiBaseUrl } from "@/lib/client"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { createFlagsClient, type FlagState } from "@/lib/flags/client"

export { FLAG_DEFAULTS, OFF, type FlagState } from "@/lib/flags/client"

const STORAGE_KEY = "prabhat-flags"

const enabled = !MOCKUP_DATA && process.env.EXPO_PUBLIC_FLAGS !== "off" && Boolean(apiBaseUrl)

export const flags = createFlagsClient({
  endpoint: enabled ? `${apiBaseUrl.replace(/\/$/, "")}/api/v1/flags` : undefined,
  fetch: (input, init) => fetch(input, init),
  installId: getInstallId,
  appVersion: Constants.expoConfig?.version,
  platform: Platform.OS,
  storage: {
    get: () => AsyncStorage.getItem(STORAGE_KEY),
    set: (value) => AsyncStorage.setItem(STORAGE_KEY, value),
  },
  onExposure: (flag, variant) => track("flag_exposure", { flag, variant }),
})

/** Call once when the app starts: read the saved answer, then ask the server in the background. */
export async function startFlags(): Promise<void> {
  await flags.load()
  void flags.refresh()
}

/**
 * `const { enabled, variant } = useFeatureFlag("new_upload_wizard")`.
 * Re-renders when the answer arrives. Records the A/B exposure the first time a screen reads it.
 */
export function useFeatureFlag(key: string): FlagState {
  useSyncExternalStore(flags.subscribe, flags.snapshot, flags.snapshot)
  return flags.use(key)
}
