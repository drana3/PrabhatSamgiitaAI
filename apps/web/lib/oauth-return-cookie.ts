import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import { safeSignInNextPath } from "@/lib/sign-in"
import { requestIsSecure } from "@/lib/site-origin"

export const OAUTH_RETURN_COOKIE = "ps_oauth_return"

export function readOAuthReturnPath(raw: string | undefined | null) {
  if (!raw) return "/"
  try {
    return safeSignInNextPath(decodeURIComponent(raw))
  } catch {
    return safeSignInNextPath(raw)
  }
}

export function writeClientOAuthValue(name: string, value: string, maxAgeSeconds = 900) {
  if (typeof document === "undefined") return
  const secure = window.location.protocol === "https:" ? "; secure" : ""
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax${secure}`
}

export function readClientOAuthValue(name: string) {
  if (typeof document === "undefined") return null
  const prefix = `${name}=`
  for (const part of document.cookie.split("; ")) {
    if (!part.startsWith(prefix)) continue
    const raw = part.slice(prefix.length)
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }
  return null
}

export function clearClientOAuthValue(name: string) {
  if (typeof document === "undefined") return
  const secure = window.location.protocol === "https:" ? "; secure" : ""
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax${secure}`
}

export function writeOAuthReturnCookie(next: string) {
  writeClientOAuthValue(OAUTH_RETURN_COOKIE, safeSignInNextPath(next))
}

export function clearOAuthReturnCookieScript() {
  clearClientOAuthValue(OAUTH_RETURN_COOKIE)
}

export function memberAuthCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  }
}

export { LOCAL_AUTH_COOKIE, requestIsSecure }
