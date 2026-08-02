export function safeSignInNextPath(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/"
  return next
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
