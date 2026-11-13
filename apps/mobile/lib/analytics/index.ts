import Constants from "expo-constants"
import { AppState, Platform } from "react-native"

import { apiBaseUrl } from "@/lib/client"
import { getActiveLanguage } from "@/lib/i18n/core"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { createAnalytics, noopAnalytics, type Analytics } from "@/lib/analytics/client"
import type { EventName, EventProps } from "@/lib/analytics/events"
import { getInstallId } from "@/lib/analytics/installId"
import { useAnalyticsConsentStore } from "@/stores/analyticsConsentStore"

export { EVENT_SPEC, type EventName, type EventProps } from "@/lib/analytics/events"
export type { AnalyticsMode } from "@/lib/analytics/client"

/** A random id for this launch only. Never saved: it lets the server group one visit, not one person. */
function makeSessionId(): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("")
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`
}
export const SESSION_ID = makeSessionId()

const enabled = !MOCKUP_DATA && process.env.EXPO_PUBLIC_ANALYTICS !== "off" && Boolean(apiBaseUrl)

let client: Analytics | null = null

function instance(): Analytics {
  if (client) return client
  client = enabled
    ? createAnalytics({
        endpoint: `${apiBaseUrl.replace(/\/$/, "")}/api/v1/events`,
        fetch: (input, init) => fetch(input, init),
        mode: () => useAnalyticsConsentStore.getState().mode,
        installId: getInstallId,
        sessionId: SESSION_ID,
        appVersion: Constants.expoConfig?.version,
        platform: Platform.OS,
        language: () => getActiveLanguage(),
      })
    : noopAnalytics
  if (enabled) {
    // send what is waiting when the app goes to the background
    AppState.addEventListener("change", (state) => {
      if (state !== "active") void instance().flush()
    })
  }
  return client
}

/** `track("search", { mode: "voice", has_results: true })`. Safe to call anywhere; never throws. */
export function track(name: EventName, props?: EventProps): void {
  instance().track(name, props)
}

export function flushAnalytics(): Promise<void> {
  return instance().flush()
}
