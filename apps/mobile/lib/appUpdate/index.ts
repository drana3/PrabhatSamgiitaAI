import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"
import { useEffect, useState } from "react"
import { AppState, Platform } from "react-native"

import { apiBaseUrl } from "@/lib/client"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import {
  OK,
  bannerDismissed,
  checkForUpdate,
  dismissBanner,
  safeStoreUrl,
  storeTarget as storeTargetFor,
  type UpdateAnswer,
  type UpdateDeps,
} from "@/lib/appUpdate/policy"

export { type UpdateAnswer } from "@/lib/appUpdate/policy"

export const ANDROID_PACKAGE = "net.prabhatasamgiita.ai"

/**
 * App Store page of the app, set in the build environment (EAS) once the app exists in App Store Connect:
 * EXPO_PUBLIC_IOS_APP_STORE_URL=https://apps.apple.com/app/id<number>. Empty on purpose until then.
 * (The server may also hand out a link: `PUT /api/v1/admin/app-versions/ios`, which wins.)
 */
export const IOS_APP_STORE_URL = safeStoreUrl(process.env.EXPO_PUBLIC_IOS_APP_STORE_URL)

/** The address of the "Update" button for this phone, or null when nothing is known. */
export function storeTarget(answer: UpdateAnswer, platform: string | undefined) {
  return storeTargetFor(answer, platform, ANDROID_PACKAGE, IOS_APP_STORE_URL)
}

const enabled = !MOCKUP_DATA && process.env.EXPO_PUBLIC_UPDATE_CHECK !== "off" && Boolean(apiBaseUrl)

const deps: UpdateDeps = {
  endpoint: enabled ? `${apiBaseUrl.replace(/\/$/, "")}/api/v1/app/version-status` : undefined,
  fetch: (input, init) => fetch(input, init),
  appVersion: Constants.expoConfig?.version,
  platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined,
  storage: {
    get: (key) => AsyncStorage.getItem(key),
    set: (key, value) => AsyncStorage.setItem(key, value),
  },
}

export function appPlatform() {
  return deps.platform
}

export async function dismissUpdateBanner(answer: UpdateAnswer) {
  await dismissBanner(deps, answer)
}

/** Asks at launch and each time the app comes back to the front (at most once a minute). */
export function useUpdateAnswer(): { answer: UpdateAnswer; bannerHidden: boolean; hideBanner: () => void } {
  const [answer, setAnswer] = useState<UpdateAnswer>(OK)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let cancelled = false
    let last = 0
    const look = async () => {
      if (Date.now() - last < 60_000) return
      last = Date.now()
      const next = await checkForUpdate(deps)
      const dismissed = await bannerDismissed(deps, next)
      if (cancelled) return
      setAnswer(next)
      setHidden(dismissed)
    }
    void look()
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void look()
    })
    return () => {
      cancelled = true
      sub.remove()
    }
  }, [])

  return {
    answer,
    bannerHidden: hidden,
    hideBanner: () => {
      setHidden(true)
      void dismissBanner(deps, answer)
    },
  }
}
