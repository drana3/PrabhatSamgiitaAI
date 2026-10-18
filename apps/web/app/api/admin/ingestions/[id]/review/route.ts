import type { NextRequest } from "next/server"

import { forwardMemberAdmin } from "@/lib/member-admin-proxy"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return forwardMemberAdmin(request, `ingestions/${encodeURIComponent(id)}/review`, {
    method: "POST",
    body: await request.text(),
  })
}
