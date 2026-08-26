"use client"

import { useEffect, useMemo, useState } from "react"
import { HARMONIUM_PRACTICE_STORAGE_KEY, harmoniumPracticeActive } from "@prabhat/core"

import { useMember } from "@/components/member-provider"

export function readHarmoniumPracticeEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(HARMONIUM_PRACTICE_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function writeHarmoniumPracticeEnabled(enabled: boolean) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(HARMONIUM_PRACTICE_STORAGE_KEY, enabled ? "1" : "0")
    window.dispatchEvent(new Event("prabhat-harmonium-practice"))
  } catch {
    /* private mode */
  }
}

export function useHarmoniumPracticeEnabled(): boolean {
  const { session } = useMember()
  const [enabled, setEnabled] = useState(() =>
    typeof window === "undefined" ? false : readHarmoniumPracticeEnabled(),
  )

  useEffect(() => {
    setEnabled(readHarmoniumPracticeEnabled())
    function onChange() {
      setEnabled(readHarmoniumPracticeEnabled())
    }
    window.addEventListener("storage", onChange)
    window.addEventListener("prabhat-harmonium-practice", onChange)
    return () => {
      window.removeEventListener("storage", onChange)
      window.removeEventListener("prabhat-harmonium-practice", onChange)
    }
  }, [])

  return useMemo(
    () => harmoniumPracticeActive(session.authenticated, enabled),
    [session.authenticated, enabled],
  )
}
