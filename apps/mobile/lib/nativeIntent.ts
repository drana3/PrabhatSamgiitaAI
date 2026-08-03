/**
 * Rewrite OS launch / deep-link URLs before Expo Router matches them.
 * Custom-scheme cold starts often arrive as `prabhatai:///` (unmatched).
 */
export function rewriteNativeSystemPath(path: string): string {
  const raw = path?.trim()
  if (!raw || raw === "/" || raw === "prabhatai:" || raw === "prabhatai://" || raw === "prabhatai:///") {
    return "/"
  }

  // Already a normal in-app path.
  if (!raw.includes("://")) {
    return raw.startsWith("/") ? raw : `/${raw}`
  }

  try {
    const url = new URL(raw)
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
