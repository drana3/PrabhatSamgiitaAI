"use client"

import { useEffect } from "react"

import { scrollToSectionId } from "@/lib/scroll-to-section"
import type { SongSection } from "@/lib/song-path"

const SONG_SECTIONS = new Set<SongSection>(["ask", "lyrics", "meaning", "listen", "watch", "notation"])

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
    const section = (rawHash ? decodeURIComponent(rawHash) : "lyrics") as SongSection
    if (rawHash && !SONG_SECTIONS.has(section)) return

    // Default / catalog links land on lyrics so the first paint is words, not the player.
    if (!rawHash || section === "lyrics") {
      if (!rawHash) {
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}#lyrics`)
      }
      let cancelled = false
      const land = () => {
        if (cancelled) return
        const lyrics = document.getElementById("lyrics")
        if (lyrics) scrollToSectionId("lyrics")
        else scrollToSongStart()
      }
      const settle = () => requestAnimationFrame(() => requestAnimationFrame(land))
      settle()
      void document.fonts.ready.then(settle)
      const timeout = window.setTimeout(settle, 300)
      return () => {
        cancelled = true
        window.clearTimeout(timeout)
      }
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
