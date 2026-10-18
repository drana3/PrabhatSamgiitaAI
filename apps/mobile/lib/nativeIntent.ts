import { webUrlToAppPath } from "@/lib/deepLinks"

/**
 * Rewrite OS launch / deep-link URLs before Expo Router matches them.
 * Custom-scheme cold starts often arrive as `prabhatai:///` (unmatched).
 */
export function rewriteNativeSystemPath(path: string): string {
  const raw = path?.trim()
  if (!raw || raw === "/" || raw === "prabhatai:" || raw === "prabhatai://" || raw === "prabhatai:///") {
    return "/"
  }

  const fromWeb = webUrlToAppPath(raw)
  if (fromWeb) return fromWeb

  // Already a normal in-app path.
  if (!raw.includes("://")) {
    const normalized = raw.startsWith("/") ? raw : `/${raw}`
    const songPath = normalized.match(/^\/songs\/(\d+)\/?$/i)
    if (songPath) return `/song/ps-${songPath[1]}`
    return normalized
  }

  try {
    const url = new URL(raw)
    if (url.protocol === "https:" || url.protocol === "http:") {
      const mapped = webUrlToAppPath(raw)
      if (mapped) return mapped
      return raw
    }

    if (url.protocol !== "prabhatai:") {
      return raw
    }

    // `prabhatai://auth` → hostname "auth"; `prabhatai:///auth` → pathname "/auth"
    const host = url.hostname
    const pathname = url.pathname === "/" ? "" : url.pathname
    const search = url.search || ""

    if (host === "auth" || pathname === "/auth") {
      return `/auth${search}`
    }

    if (!host && !pathname) {
      return search ? `/${search}` : "/"
    }

    if (!host) {
      return `${pathname || "/"}${search}`
    }

    return `/${host}${pathname}${search}`
  } catch {
    return "/"
  }
}
