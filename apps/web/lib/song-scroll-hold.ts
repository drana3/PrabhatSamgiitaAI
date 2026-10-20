"use client"

import { useLayoutEffect } from "react"

import { scrollToSectionId } from "@/lib/scroll-to-section"

const HOLD_ATTR = "data-song-scroll-hold"

/** True when the URL still means “stay on lyrics” (default landing). */
export function isLyricsLandingHash(): boolean {
  if (typeof window === "undefined") return true
  const hash = window.location.hash.slice(1)
  return !hash || hash === "lyrics"
}

/**
 * While *active*, keep the viewport pinned to *sectionId* across layout shifts
 * (Central idea progress/result). Releases immediately if the user changes hash.
 */
export function useSongScrollHold(sectionId: string, active: boolean) {
  useLayoutEffect(() => {
    if (!active || typeof window === "undefined") return
    if (!isLyricsLandingHash() && sectionId === "lyrics") return

    document.documentElement.setAttribute(HOLD_ATTR, sectionId)
    document.documentElement.style.setProperty("overflow-anchor", "none")

    let frame = 0
    const pin = () => {
      const hold = document.documentElement.getAttribute(HOLD_ATTR)
      if (hold !== sectionId) return
      if (sectionId === "lyrics" && !isLyricsLandingHash()) {
        document.documentElement.removeAttribute(HOLD_ATTR)
        return
      }
      const live = window.location.hash.slice(1)
      if (live && live !== sectionId) {
        document.documentElement.removeAttribute(HOLD_ATTR)
        return
      }
      scrollToSectionId(sectionId)
    }

    const schedulePin = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        requestAnimationFrame(pin)
      })
    }

    pin()
    schedulePin()

    const roots: Element[] = []
    const meaning = document.getElementById("meaning")
    const lyrics = document.getElementById("lyrics")
    const main = document.querySelector("main")
    if (meaning) roots.push(meaning)
    if (lyrics) roots.push(lyrics)
    if (main) roots.push(main)

    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedulePin) : null
    if (ro) {
      for (const el of roots) ro.observe(el)
    }

    window.addEventListener("hashchange", pin)

    return () => {
      cancelAnimationFrame(frame)
      ro?.disconnect()
      window.removeEventListener("hashchange", pin)
      if (document.documentElement.getAttribute(HOLD_ATTR) === sectionId) {
        document.documentElement.removeAttribute(HOLD_ATTR)
      }
      document.documentElement.style.removeProperty("overflow-anchor")
    }
  }, [active, sectionId])
}
