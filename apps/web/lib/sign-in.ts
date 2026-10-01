export function safeSignInNextPath(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/"
  if (/^https?:\/\//i.test(next)) return "/"
  // Fragment identifiers are client-only and break server redirects / Easy Auth return.
  const path = next.split("#")[0]?.split("?")[0] || "/"
  if (!path.startsWith("/") || path.startsWith("//")) return "/"
  if (path === "/signin" || path.startsWith("/signin/")) return "/"
  if (/^\/\/localhost/i.test(path) || /^\/\/127\.0\.0\.1/i.test(path)) return "/"
  return path
}

/** Relative path SWA accepts after AAD login (server sets member cookie from SWA headers). */
export function microsoftEasyAuthReturnPath() {
  return "/api/auth/microsoft/complete"
}

/** Post-auth destination. Song pages skip auto-opening the AI companion after sign-in. */
export function signInReturnPath(next: string | undefined) {
  const path = safeSignInNextPath(next)
  if (path === "/signin") return "/"
  if (/^\/songs\/\d+$/.test(path)) {
    return `${path}?from=signin`
  }
  return path
}

export function microsoftCallbackPath() {
  return microsoftEasyAuthReturnPath()
}

export function microsoftSignInHref() {
  return `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(microsoftEasyAuthReturnPath())}`
}

export function googleSignInHref(next: string | undefined) {
  const destination = signInReturnPath(safeSignInNextPath(next))
  return `/.auth/login/google?post_login_redirect_uri=${encodeURIComponent(destination)}`
}

export function facebookSignInHref(next: string | undefined) {
  const destination = signInReturnPath(safeSignInNextPath(next))
  return `/.auth/login/facebook?post_login_redirect_uri=${encodeURIComponent(destination)}`
}

export function signInHref(next?: string) {
  const destination = safeSignInNextPath(next)
  if (destination === "/") return "/signin"
  return `/signin?next=${encodeURIComponent(destination)}`
}
