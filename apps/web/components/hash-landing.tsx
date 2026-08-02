"use client"

import { useEffect } from "react"

const SONG_SECTIONS = new Set(["ask", "lyrics", "meaning", "listen", "watch", "notation"])

export function HashLanding() {
  useEffect(() => {
    const section = decodeURIComponent(window.location.hash.slice(1))
    if (!SONG_SECTIONS.has(section)) return

    let cancelled = false
    const scrollToSection = () => {
      if (!cancelled) document.getElementById(section)?.scrollIntoView({ block: "start" })
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
