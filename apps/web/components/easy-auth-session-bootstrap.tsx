"use client"

import { useEffect, useRef } from "react"

import { useMember } from "@/components/member-provider"

export function EasyAuthSessionBootstrap() {
  const { refresh } = useMember()
  const started = useRef(false)

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== "true") return
    if (started.current) return
    started.current = true

    void fetch("/api/auth/easy-auth-sync", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((response) => (response.ok ? refresh({ silent: true }) : undefined))
      .catch(() => undefined)
  }, [refresh])

  return null
}
