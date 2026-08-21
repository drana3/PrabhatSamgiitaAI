import type { NextRequest } from "next/server"

import { forwardMemberAdmin } from "@/lib/member-admin-proxy"

export const maxDuration = 180

export async function POST(request: NextRequest) {
  return forwardMemberAdmin(request, "youtube-channels/scan-all", { method: "POST" })
}
