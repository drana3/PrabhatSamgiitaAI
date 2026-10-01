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

export function writeOAuthReturnCookie(next: string) {
  if (typeof document === "undefined") return
  const value = encodeURIComponent(safeSignInNextPath(next))
  const secure = window.location.protocol === "https:" ? "; secure" : ""
  document.cookie = `${OAUTH_RETURN_COOKIE}=${value}; path=/; max-age=900; samesite=lax${secure}`
}

export function clearOAuthReturnCookieScript() {
  if (typeof document === "undefined") return
  const secure = window.location.protocol === "https:" ? "; secure" : ""
  document.cookie = `${OAUTH_RETURN_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`
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
