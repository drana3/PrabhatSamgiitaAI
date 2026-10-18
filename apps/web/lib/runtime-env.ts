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
