import type { NextRequest } from "next/server"

import { forwardMemberAdmin } from "@/lib/member-admin-proxy"

export async function GET(request: NextRequest) {
  const incoming = new URL(request.url)
  return forwardMemberAdmin(request, `ingestions${incoming.search}`)
}

export async function POST(request: NextRequest) {
  const incoming = new URL(request.url)
  return forwardMemberAdmin(request, `ingestions${incoming.search}`, {
    method: "POST",
    body: await request.text(),
  })
}
