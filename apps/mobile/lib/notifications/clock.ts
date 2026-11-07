import { Platform } from "react-native"

import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * The clock the notification code reads. In the web preview only, `?at=2026-11-07T18:30` in the page
 * address (read once, when the page loads) sets "now" to that moment and lets it run on from there, so a
 * festival eve or a live reminder can be looked at on any day. Everywhere else it is Date.now().
 */
const loadedAt = Date.now()
const previewStart: number | null = (() => {
  if (!MOCKUP_DATA || Platform.OS !== "web" || typeof window === "undefined") return null
  const at = new URLSearchParams(window.location.search).get("at")
  const ms = at ? new Date(at).getTime() : Number.NaN
  return Number.isFinite(ms) ? ms : null
})()

export function nowMs(): number {
  return previewStart == null ? Date.now() : previewStart + (Date.now() - loadedAt)
}
