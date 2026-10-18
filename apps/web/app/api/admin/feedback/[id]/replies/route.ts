import type { NextRequest } from "next/server"

import { forwardMemberAdmin } from "@/lib/member-admin-proxy"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  if (!id) {
    return Response.json({ detail: "Feedback id is required" }, { status: 400 })
  }
  return forwardMemberAdmin(request, `feedback/${encodeURIComponent(id)}/replies`, {
    method: "POST",
    body: await request.text(),
  })
}
