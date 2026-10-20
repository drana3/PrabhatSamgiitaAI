"use client"

import { useEffect } from "react"

import { scrollToSectionId, stickyHeaderOffset } from "@/lib/scroll-to-section"
import type { SongSection } from "@/lib/song-path"

const SONG_SECTIONS = new Set<SongSection>(["ask", "lyrics", "meaning", "listen", "watch", "notation"])

function scrollToSongStart() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

function currentSongSection(): SongSection | null {
  const raw = window.location.hash.slice(1)
  if (!raw) return null
  try {
    const section = decodeURIComponent(raw) as SongSection
    return SONG_SECTIONS.has(section) ? section : null
  } catch {
    return null
  }
}

export function HashLanding() {
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual"

    const params = new URLSearchParams(window.location.search)
    if (params.get("from") === "signin") {
      history.replaceState(null, "", window.location.pathname)
      return
    }

    const initialHash = window.location.hash.slice(1)
    const initialSection = (initialHash ? decodeURIComponent(initialHash) : "lyrics") as SongSection
    if (initialHash && !SONG_SECTIONS.has(initialSection)) return

    // Default / catalog links land on lyrics so the first paint is words, not the player.
    if (!initialHash || initialSection === "lyrics") {
      if (!initialHash && !window.location.hash) {
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}#lyrics`)
      }
      let cancelled = false
      let hasLandedOnLyrics = false
      const land = () => {
        if (cancelled) return
        // Language switch / section chips may have moved the hash (e.g. #meaning)
        // before fonts.ready or the 300ms settle fire — honor the live hash.
        const live = currentSongSection()
        if (live && live !== "lyrics") {
          scrollToSectionId(live)
          return
        }
        const lyrics = document.getElementById("lyrics")
        if (!lyrics) {
          scrollToSongStart()
          return
        }
        // After the first lyrics land, skip late settles that fight Central idea
        // progress on first open from Explore (Listen flash).
        if (hasLandedOnLyrics) {
          const top = lyrics.getBoundingClientRect().top
          const header = stickyHeaderOffset()
          if (top >= header - 24 && top <= header + 220) return
        }
        scrollToSectionId("lyrics")
        hasLandedOnLyrics = true
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
      if (cancelled) return
      const live = currentSongSection() ?? initialSection
      scrollToSectionId(live)
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
