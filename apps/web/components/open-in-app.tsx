"use client"

import { useEffect } from "react"

function isMobileBrowser() {
  if (typeof navigator === "undefined") return false
  if (navigator.webdriver) return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

function shouldOpenApp() {
  if (typeof window === "undefined") return false
  return new URLSearchParams(window.location.search).get("open") === "app"
}

/** Shared song links (?open=app) hand off to the installed app. */
export function OpenInApp({ songNumber }: { songNumber: number }) {
  useEffect(() => {
    if (!shouldOpenApp() || !isMobileBrowser()) return
    if (!Number.isFinite(songNumber) || songNumber < 1) return
    const key = `ps-open-app-${songNumber}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, "1")
    } catch {
      return
    }
    window.location.href = `prabhatai:///song/ps-${songNumber}`
  }, [songNumber])

  return null
}
