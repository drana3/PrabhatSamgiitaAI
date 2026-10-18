import type { NextRequest } from "next/server"

import { forwardMemberAdmin } from "@/lib/member-admin-proxy"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return forwardMemberAdmin(request, `youtube-reviews/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body: await request.text(),
  })
}
