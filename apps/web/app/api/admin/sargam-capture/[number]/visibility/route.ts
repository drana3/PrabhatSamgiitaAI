import type { NextRequest } from "next/server"

import { forwardMemberAdmin } from "@/lib/member-admin-proxy"

export async function POST(request: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params
  return forwardMemberAdmin(request, `songs/${encodeURIComponent(number)}/sargam-capture/visibility`, {
    method: "POST",
    body: await request.text(),
  })
}
