type AdminSessionFlags = {
  isSuperAdmin: boolean
}

type CachedFlags = AdminSessionFlags & { at: number }

const TTL_MS = 60_000
let cached: CachedFlags | null = null
let inflight: Promise<AdminSessionFlags> | null = null

/** Shared admin session flags so ingest/nav does not wait on a cold session fetch. */
export async function getAdminSessionFlags(): Promise<AdminSessionFlags> {
  if (cached && Date.now() - cached.at < TTL_MS) {
    return { isSuperAdmin: cached.isSuperAdmin }
  }
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const response = await fetch("/api/member/session", {
        credentials: "same-origin",
        cache: "no-store",
      })
      if (!response.ok) {
        const flags = { isSuperAdmin: false }
        cached = { ...flags, at: Date.now() }
        return flags
      }
      const body = (await response.json().catch(() => null)) as {
        is_super_admin?: boolean
      } | null
      const flags = { isSuperAdmin: Boolean(body?.is_super_admin) }
      cached = { ...flags, at: Date.now() }
      return flags
    } catch {
      const flags = { isSuperAdmin: false }
      cached = { ...flags, at: Date.now() }
      return flags
    } finally {
      inflight = null
    }
  })()

  return inflight
}

export function clearAdminSessionCache() {
  cached = null
  inflight = null
}
