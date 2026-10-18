import type { NextRequest } from "next/server"

import { forwardMemberAdmin } from "@/lib/member-admin-proxy"
import { runtimeEnv } from "@/lib/runtime-env"

export async function GET(request: NextRequest) {
  return forwardMemberAdmin(request, "quiz-events")
}

export async function POST(request: NextRequest) {
  return forwardMemberAdmin(request, "quiz-events", {
    method: "POST",
    body: await request.text(),
  })
}

export async function PATCH(request: NextRequest) {
  const incoming = new URL(request.url)
  const eventId = incoming.searchParams.get("id")
  const action = incoming.searchParams.get("action")
  if (!eventId || !action) {
    return Response.json({ detail: "Event id and action are required" }, { status: 400 })
  }
  return forwardMemberAdmin(request, `quiz-events/${encodeURIComponent(eventId)}/${action}`, {
    method: "POST",
    body: await request.text(),
  })
}
