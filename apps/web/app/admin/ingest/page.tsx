"use client"

import { useEffect, useState } from "react"

import { AdminIngestionPanel } from "@/components/admin-ingestion-panel"
import { getAdminSessionFlags } from "@/lib/admin-session-cache"

export default function AdminIngestPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    let active = true
    void getAdminSessionFlags().then((flags) => {
      if (active) setIsSuperAdmin(flags.isSuperAdmin)
    })
    return () => {
      active = false
    }
  }, [])

  return <AdminIngestionPanel isSuperAdmin={isSuperAdmin} />
}
