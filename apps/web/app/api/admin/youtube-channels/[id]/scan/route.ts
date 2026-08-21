import type { NextRequest } from "next/server"

import { forwardMemberAdmin } from "@/lib/member-admin-proxy"

export const maxDuration = 120

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  return forwardMemberAdmin(request, `youtube-channels/${encodeURIComponent(id)}/scan`, {
    method: "POST",
  })
}
