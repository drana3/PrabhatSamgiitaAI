"use client"

import { useEffect, useState } from "react"

export type SongPageLayout = "mobile" | "sidebar"

/** xl sidebar layout — null until the client knows the viewport width. */
export function useSongPageLayout(): SongPageLayout | null {
  const [layout, setLayout] = useState<SongPageLayout | null>(null)

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)")
    const update = () => setLayout(media.matches ? "sidebar" : "mobile")
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  return layout
}

export function isSidebarSongLayout() {
  return typeof window.matchMedia === "function"
    && window.matchMedia("(min-width: 1280px)").matches
}
