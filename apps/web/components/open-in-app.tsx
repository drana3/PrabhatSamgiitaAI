"use client"

import { useEffect } from "react"

function isMobileBrowser() {
  if (typeof navigator === "undefined") return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

/** If the app is installed, hand a shared song URL over to it. */
export function OpenInApp({ songNumber }: { songNumber: number }) {
  useEffect(() => {
    if (!isMobileBrowser() || !Number.isFinite(songNumber) || songNumber < 1) return
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
