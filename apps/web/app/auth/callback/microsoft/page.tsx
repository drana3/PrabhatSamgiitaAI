"use client"

import { useEffect } from "react"

/** Legacy redirect target — use the server completion route. */
export default function MicrosoftAuthCallbackPage() {
  useEffect(() => {
    window.location.replace("/api/auth/microsoft/complete")
  }, [])

  return null
}
