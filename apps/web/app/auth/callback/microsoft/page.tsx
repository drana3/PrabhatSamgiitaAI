"use client"

import { useEffect } from "react"

/** Old SWA redirect target — forward to the supported finish flow. */
export default function MicrosoftAuthCallbackPage() {
  useEffect(() => {
    window.location.replace("/signin?easyAuth=microsoft")
  }, [])

  return null
}
