import { scrubBreadcrumb, scrubEvent } from "@/lib/observability/scrub"

/**
 * Crash reports (Sentry). OFF without a DSN, and off when the person chose "Off" in
 * Profile, Usage data. The DSN comes from the build environment (EXPO_PUBLIC_SENTRY_DSN, an EAS
 * variable); it is a public address, not a secret, but it is not written in the repository either.
 *
 * `@sentry/react-native` is required inside try/catch so a build without the native module (or a
 * test) simply has no crash reports instead of crashing.
 */
export type CrashReportOptions = {
  dsn: string | undefined
  release: string | undefined
  environment: string
  mode: "anonymous" | "shared" | "off"
}

export function crashReportOptions(o: CrashReportOptions): Record<string, unknown> | null {
  const dsn = (o.dsn ?? "").trim()
  if (!dsn || o.mode === "off") return null
  return {
    dsn,
    release: o.release,
    environment: o.environment,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableAutoSessionTracking: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 30,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  }
}

type SentryModule = { init: (options: Record<string, unknown>) => void; close?: () => Promise<boolean> }

let started = false

export function startCrashReports(options: CrashReportOptions, load: () => SentryModule = loadSentry): boolean {
  const config = crashReportOptions(options)
  if (!config) {
    if (started) {
      // the person turned reports off: stop sending
      try {
        void load().close?.()
      } catch {
        // nothing to close
      }
      started = false
    }
    return false
  }
  if (started) return true
  try {
    load().init(config)
    started = true
    return true
  } catch {
    return false
  }
}

function loadSentry(): SentryModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@sentry/react-native") as SentryModule
}

/** For tests. */
export function resetCrashReportsForTests(): void {
  started = false
}
