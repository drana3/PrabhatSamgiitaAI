"use client"

import { AdminFeedbackPanel } from "@/components/admin-feedback-panel"

/** Client-first so AdminShell paints immediately; feedback loads after navigation. */
export default function AdminFeedbackPage() {
  return <AdminFeedbackPanel initialStatus="new" />
}
