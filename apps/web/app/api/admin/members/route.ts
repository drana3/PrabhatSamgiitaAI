import type { NextRequest } from "next/server"

import { forwardMemberAdmin } from "@/lib/member-admin-proxy"

export async function GET(request: NextRequest) {
  return forwardMemberAdmin(request, "users")
}

export async function POST(request: NextRequest) {
  return forwardMemberAdmin(request, "grant", {
    method: "POST",
    body: await request.text(),
  })
}

export async function DELETE(request: NextRequest) {
  const incoming = new URL(request.url)
  const userId = incoming.searchParams.get("id")
  if (!userId) {
    return Response.json({ detail: "Member id is required" }, { status: 400 })
  }
  return forwardMemberAdmin(request, `users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  })
}
