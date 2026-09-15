"use client"

import { useSyncExternalStore } from "react"

export type SongPageLayout = "mobile" | "sidebar"

const XL_QUERY = "(min-width: 1280px)"

function readLayout(): SongPageLayout {
  return window.matchMedia(XL_QUERY).matches ? "sidebar" : "mobile"
}

function subscribe(onStoreChange: () => void) {
  const media = window.matchMedia(XL_QUERY)
  media.addEventListener("change", onStoreChange)
  return () => media.removeEventListener("change", onStoreChange)
}

/** xl sidebar layout — mobile-first during SSR, then matches the viewport. */
export function useSongPageLayout(): SongPageLayout {
  return useSyncExternalStore(subscribe, readLayout, () => "mobile")
}
