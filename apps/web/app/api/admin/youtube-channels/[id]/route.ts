import type { NextRequest } from "next/server"

import { forwardMemberAdmin } from "@/lib/member-admin-proxy"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  return forwardMemberAdmin(request, `youtube-channels/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: await request.text(),
  })
}
