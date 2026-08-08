import { NextRequest, NextResponse } from "next/server"

import { runtimeEnv } from "@/lib/runtime-env"

function backendBase() {
  return runtimeEnv("API_BASE_URL")
    ?? runtimeEnv("NEXT_PUBLIC_API_BASE_URL")
    ?? "http://localhost:8000"
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const response = await fetch(`${backendBase()}/api/v1/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  })
  const text = await response.text()
  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store, private",
    },
  })
}
