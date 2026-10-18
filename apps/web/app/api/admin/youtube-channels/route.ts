import type { NextRequest } from "next/server"

import { forwardMemberAdmin } from "@/lib/member-admin-proxy"

export async function GET(request: NextRequest) {
  return forwardMemberAdmin(request, "youtube-channels")
}

export async function POST(request: NextRequest) {
  return forwardMemberAdmin(request, "youtube-channels", {
    method: "POST",
    body: await request.text(),
  })
}
