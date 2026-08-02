import { headers } from "next/headers"

import { AdminFeedbackPanel } from "@/components/admin-feedback-panel"
import { fetchAdminFeedback } from "@/lib/member-admin-proxy"

export const dynamic = "force-dynamic"

export default async function AdminFeedbackPage() {
  const headerList = await headers()
  const initialData = await fetchAdminFeedback(headerList, "new")
  return <AdminFeedbackPanel initialStatus="new" initialData={initialData} />
}
