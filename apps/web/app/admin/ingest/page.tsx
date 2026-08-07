"use client"

import { useEffect, useState } from "react"

import { AdminIngestionPanel } from "@/components/admin-ingestion-panel"

export default function AdminIngestPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  useEffect(() => {
    void fetch("/api/member/session", { credentials: "same-origin", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (body && typeof body === "object" && "is_super_admin" in body) {
          setIsSuperAdmin(Boolean((body as { is_super_admin?: boolean }).is_super_admin))
        }
      })
      .catch(() => undefined)
  }, [])
  return <AdminIngestionPanel isSuperAdmin={isSuperAdmin} />
}
