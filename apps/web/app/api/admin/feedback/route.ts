import type { NextRequest } from "next/server"

import { forwardMemberAdmin } from "@/lib/member-admin-proxy"

export async function GET(request: NextRequest) {
  return forwardMemberAdmin(request, "feedback")
}

export async function PATCH(request: NextRequest) {
  const incoming = new URL(request.url)
  const feedbackId = incoming.searchParams.get("id")
  if (!feedbackId) {
    return Response.json({ detail: "Feedback id is required" }, { status: 400 })
  }
  return forwardMemberAdmin(request, `feedback/${encodeURIComponent(feedbackId)}`, {
    method: "PATCH",
    body: await request.text(),
  })
}
