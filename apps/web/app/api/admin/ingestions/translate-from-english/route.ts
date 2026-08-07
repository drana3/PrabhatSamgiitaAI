import type { NextRequest } from "next/server"

import { forwardMemberAdmin } from "@/lib/member-admin-proxy"

export async function POST(request: NextRequest) {
  return forwardMemberAdmin(request, "ingestions/translate-from-english", {
    method: "POST",
    body: await request.text(),
  })
}
