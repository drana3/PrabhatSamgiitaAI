import type { NextRequest } from "next/server"

import { forwardMemberAdmin } from "@/lib/member-admin-proxy"

export async function GET(request: NextRequest) {
  return forwardMemberAdmin(request, "raga-collections")
}

export async function POST(request: NextRequest) {
  return forwardMemberAdmin(request, "raga-collections", {
    method: "POST",
    body: await request.text(),
  })
}

export async function DELETE(request: NextRequest) {
  const incoming = new URL(request.url)
  const label = incoming.searchParams.get("label")
  if (!label) {
    return Response.json({ detail: "label query parameter is required" }, { status: 400 })
  }
  return forwardMemberAdmin(request, `raga-collections/${encodeURIComponent(label)}`, {
    method: "DELETE",
  })
}