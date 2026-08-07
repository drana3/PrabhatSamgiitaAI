import { runtimeEnv } from "@/lib/runtime-env"

export const dynamic = "force-dynamic"

function backendBaseUrl() {
  return runtimeEnv("API_BASE_URL")
    ?? runtimeEnv("NEXT_PUBLIC_API_BASE_URL")
    ?? "http://localhost:8000"
}

export async function GET() {
  try {
    const response = await fetch(new URL("/api/v1/quiz/winners", backendBaseUrl()), {
      cache: "no-store",
    })
    const body = await response.text()
    return new Response(body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
    })
  } catch {
    return Response.json([], { status: 200 })
  }
}
