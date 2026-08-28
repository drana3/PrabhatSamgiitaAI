import type { NextRequest } from "next/server"

import { forwardMemberAdmin } from "@/lib/member-admin-proxy"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ number: string; lineNumber: string }> },
) {
  const { number, lineNumber } = await params
  return forwardMemberAdmin(
    request,
    `songs/${encodeURIComponent(number)}/sargam-capture/lines/${encodeURIComponent(lineNumber)}/confirm`,
    { method: "POST" },
  )
}
