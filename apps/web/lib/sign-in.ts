export function safeSignInNextPath(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/"
  // Fragment identifiers are client-only and break server redirects / Easy Auth return.
  const path = next.split("#")[0] || "/"
  if (!path.startsWith("/") || path.startsWith("//")) return "/"
  return path
}

export function microsoftSignInHref(next: string | undefined) {
  const destination = safeSignInNextPath(next)
  const returnTo = `/signin?next=${encodeURIComponent(destination)}`
  return `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(returnTo)}`
}

export function signInHref(next?: string) {
  const destination = safeSignInNextPath(next)
  if (destination === "/") return "/signin"
  return `/signin?next=${encodeURIComponent(destination)}`
}
