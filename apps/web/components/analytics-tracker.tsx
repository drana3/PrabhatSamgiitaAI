"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { trackEvent } from "@/lib/analytics"

export function AnalyticsTracker() {
  const pathname = usePathname()

  useEffect(() => trackEvent("page_view", pathname), [pathname])
  useEffect(() => {
    const trackClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-feature]") : null
      if (target?.dataset.feature) trackEvent("feature_use", target.dataset.feature)
    }
    document.addEventListener("click", trackClick)
    return () => document.removeEventListener("click", trackClick)
  }, [])
  return null
}
