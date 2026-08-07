export function safeSignInNextPath(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/"
  // Fragment identifiers are client-only and break server redirects / Easy Auth return.
  const path = next.split("#")[0] || "/"
  if (!path.startsWith("/") || path.startsWith("//")) return "/"
  return path
}

/** Post-auth destination. Song pages skip auto-opening the AI companion after sign-in. */
export function signInReturnPath(next: string | undefined) {
  const path = safeSignInNextPath(next)
  if (/^\/songs\/\d+$/.test(path)) {
    return `${path}?from=signin`
  }
  return path
}

export function microsoftSignInHref(next: string | undefined) {
  const destination = safeSignInNextPath(next)
  const returnTo = `/signin?next=${encodeURIComponent(destination)}`
  return `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(returnTo)}`
}

export function googleSignInHref(next: string | undefined) {
  const destination = safeSignInNextPath(next)
  const returnTo = `/signin?next=${encodeURIComponent(destination)}`
  return `/.auth/login/google?post_login_redirect_uri=${encodeURIComponent(returnTo)}`
}

export function facebookSignInHref(next: string | undefined) {
  const destination = safeSignInNextPath(next)
  const returnTo = `/signin?next=${encodeURIComponent(destination)}`
  return `/.auth/login/facebook?post_login_redirect_uri=${encodeURIComponent(returnTo)}`
}

export function signInHref(next?: string) {
  const destination = safeSignInNextPath(next)
  if (destination === "/") return "/signin"
  return `/signin?next=${encodeURIComponent(destination)}`
}
