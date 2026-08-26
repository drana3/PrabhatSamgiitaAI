"use client"

import { useEffect } from "react"

import { scrollToSectionId } from "@/lib/scroll-to-section"
import type { SongSection } from "@/lib/song-path"

const SONG_SECTIONS = new Set<SongSection>(["ask", "lyrics", "meaning", "listen", "watch", "notation"])

function isMobileViewport() {
  return typeof window.matchMedia === "function"
    && window.matchMedia("(max-width: 767px)").matches
}

function scrollToSongStart() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

export function HashLanding() {
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual"

    const params = new URLSearchParams(window.location.search)
    if (params.get("from") === "signin") {
      history.replaceState(null, "", window.location.pathname)
      return
    }

    const rawHash = window.location.hash.slice(1)
    const mobile = isMobileViewport()

    // Mobile: open at the song hero/start. Keep deep links to lyrics, listen, etc.
    // Treat bare #ask (the usual song link) as the song start so search/explore
    // results do not jump past the title and lyrics.
    if (mobile && (!rawHash || rawHash === "ask")) {
      if (rawHash) {
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}`)
      }
      let cancelled = false
      const settle = () => {
        if (!cancelled) scrollToSongStart()
      }
      settle()
      requestAnimationFrame(() => requestAnimationFrame(settle))
      void document.fonts.ready.then(settle)
      const timeout = window.setTimeout(settle, 300)
      const lateTimeout = window.setTimeout(settle, 900)
      return () => {
        cancelled = true
        window.clearTimeout(timeout)
        window.clearTimeout(lateTimeout)
      }
    }

    const section = rawHash ? decodeURIComponent(rawHash) : "ask"
    if (!SONG_SECTIONS.has(section as SongSection)) return

    if (!rawHash) {
      const nextUrl = `${window.location.pathname}${window.location.search}#ask`
      history.replaceState(null, "", nextUrl)
    }

    let cancelled = false
    const scrollToSection = () => {
      if (!cancelled) scrollToSectionId(section)
    }
    const settle = () => requestAnimationFrame(() => requestAnimationFrame(scrollToSection))
    settle()
    void document.fonts.ready.then(settle)
    const timeout = window.setTimeout(settle, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [])

  return null
}
