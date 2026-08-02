"use client"

import { useEffect } from "react"

export function SongScrollTop({ songNumber }: { songNumber: number }) {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(min-width: 768px)").matches) return
    if (window.location.hash) return

    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  }, [songNumber])

  return null
}
