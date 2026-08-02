"use client"

import { useEffect } from "react"

import { scrollToSectionId } from "@/lib/scroll-to-section"
import type { SongSection } from "@/lib/song-path"

const SONG_SECTIONS = new Set<SongSection>(["ask", "lyrics", "meaning", "listen", "watch", "notation"])

export function HashLanding() {
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual"

    const rawHash = window.location.hash.slice(1)
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
