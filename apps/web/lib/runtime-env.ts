/**
 * Read server env at request time.
 * Dynamic key access avoids Next.js build-time inlining of secrets that are
 * only present in the Azure Container Apps runtime (e.g. MEMBER_PROXY_KEY).
 */
export function runtimeEnv(name: string): string | undefined {
  const value = process.env[name]
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

/** Google OAuth client id for server-side code exchange. */
export function googleOAuthClientId(): string | undefined {
  return (
    runtimeEnv("GOOGLE_CLIENT_ID") ??
    (typeof process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID === "string"
      ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID.trim() || undefined
      : undefined)
  )
}

/**
 * Headers that prove the website server to the API. `X-Member-Proxy-Key` is the old shared key (it also
 * ships inside the mobile app, so the API treats it as a plain member). `X-Web-Proxy-Key` is a key only this
 * server holds (WEB_PROXY_KEY); with it the API trusts the website for admin. Both are sent while the
 * migration runs; an API without WEB_PROXY_KEY ignores the second one.
 */
export function proxyKeyHeaders(proxyKey: string): Record<string, string> {
  const webKey = runtimeEnv("WEB_PROXY_KEY")
  return webKey
    ? { "X-Member-Proxy-Key": proxyKey, "X-Web-Proxy-Key": webKey }
    : { "X-Member-Proxy-Key": proxyKey }
}
