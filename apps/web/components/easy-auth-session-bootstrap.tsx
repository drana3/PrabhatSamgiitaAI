"use client"

import { useEffect, useRef } from "react"

import { useMember } from "@/components/member-provider"
import { syncEasyAuthSessionFromBrowser } from "@/lib/easy-auth-client"

export function EasyAuthSessionBootstrap() {
  const { refresh } = useMember()
  const started = useRef(false)

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== "true") return
    if (started.current) return
    started.current = true

    void syncEasyAuthSessionFromBrowser()
      .then((ok) => (ok ? refresh({ silent: true }) : undefined))
      .catch(() => undefined)
  }, [refresh])

  return null
}
