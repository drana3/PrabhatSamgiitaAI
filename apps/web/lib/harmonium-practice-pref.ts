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

/** Local song pages skip sign-in so you can try the keyboard. Production stays gated. */
export function isLocalHarmoniumPreview(): boolean {
  if (process.env.NODE_ENV === "production") return false
  if (typeof window === "undefined") return process.env.NODE_ENV === "development"
  const host = window.location.hostname
  return host === "localhost" || host === "127.0.0.1"
}

export function useHarmoniumPracticeEnabled(): boolean {
  const { session } = useMember()
  const [enabled, setEnabled] = useState(() =>
    typeof window === "undefined" ? false : readHarmoniumPracticeEnabled(),
  )
  const [localPreview, setLocalPreview] = useState(() => isLocalHarmoniumPreview())

  useEffect(() => {
    setEnabled(readHarmoniumPracticeEnabled())
    setLocalPreview(isLocalHarmoniumPreview())
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
    () => localPreview || harmoniumPracticeActive(session.authenticated, enabled),
    [localPreview, session.authenticated, enabled],
  )
}
