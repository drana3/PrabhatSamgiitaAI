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
