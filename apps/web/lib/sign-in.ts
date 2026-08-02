export function safeSignInNextPath(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/"
  return next
}

export function microsoftSignInHref(next: string | undefined) {
  const destination = encodeURIComponent(safeSignInNextPath(next))
  return `/.auth/login/aad?post_login_redirect_uri=${destination}`
}

export function signInHref(next?: string) {
  const destination = safeSignInNextPath(next)
  if (destination === "/") return "/signin"
  return `/signin?next=${encodeURIComponent(destination)}`
}
