"use client"

import { useEffect, useMemo, useState } from "react"

import { FEELING_SEARCH_STORAGE_KEY, type SearchAuth } from "@prabhat/core"

import { useMember } from "@/components/member-provider"

export function readFeelingSearchEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(FEELING_SEARCH_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function writeFeelingSearchEnabled(enabled: boolean) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(FEELING_SEARCH_STORAGE_KEY, enabled ? "1" : "0")
    window.dispatchEvent(new Event("prabhat-feeling-search"))
  } catch {
    /* private mode */
  }
}

export function useSearchAuth(): SearchAuth {
  const { session } = useMember()
  const [feelingSearchEnabled, setFeelingSearchEnabled] = useState(false)

  useEffect(() => {
    setFeelingSearchEnabled(readFeelingSearchEnabled())
    function onChange() {
      setFeelingSearchEnabled(readFeelingSearchEnabled())
    }
    window.addEventListener("storage", onChange)
    window.addEventListener("prabhat-feeling-search", onChange)
    return () => {
      window.removeEventListener("storage", onChange)
      window.removeEventListener("prabhat-feeling-search", onChange)
    }
  }, [])

  return useMemo(
    () => ({
      signedIn: session.authenticated,
      feelingSearchEnabled: session.authenticated && feelingSearchEnabled,
    }),
    [session.authenticated, feelingSearchEnabled],
  )
}
