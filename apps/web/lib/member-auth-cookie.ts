import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"

export const MICROSOFT_NEXT_COOKIE = "ps_microsoft_next"

export function memberAuthCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  }
}

export function clearMemberAuthCookie(response: { cookies: { set: (...args: unknown[]) => void } }, secure: boolean) {
  response.cookies.set(LOCAL_AUTH_COOKIE, "", { ...memberAuthCookieOptions(secure), maxAge: 0 })
}

export function requestIsSecure(request: Request) {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  if (proto) return proto === "https"
  try {
    return new URL(request.url).protocol === "https:"
  } catch {
    return process.env.NODE_ENV === "production"
  }
}
