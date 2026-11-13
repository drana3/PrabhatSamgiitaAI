import Constants from "expo-constants"

import { startCrashReports } from "@/lib/observability/crashReports"
import { useAnalyticsConsentStore } from "@/stores/analyticsConsentStore"

/**
 * Started once from app/_layout.tsx. Crash reports follow the person's choice and start again
 * (or stop) when it changes.
 */
export function initObservability(): void {
  const apply = () =>
    startCrashReports({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? (Constants.expoConfig?.extra?.sentryDsn as string | undefined),
      release: Constants.expoConfig?.version ? `prabhat-samgiita-app@${Constants.expoConfig.version}` : undefined,
      environment: __DEV__ ? "development" : (process.env.EXPO_PUBLIC_APP_ENV ?? "production"),
      mode: useAnalyticsConsentStore.getState().mode,
    })
  if (useAnalyticsConsentStore.persist.hasHydrated()) apply()
  else useAnalyticsConsentStore.persist.onFinishHydration(apply)
  useAnalyticsConsentStore.subscribe(apply)
}
