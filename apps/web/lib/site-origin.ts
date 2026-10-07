const DEFAULT_PUBLIC_ORIGIN = "https://www.prabhatasamgiita.org"

export const CANONICAL_PUBLIC_HOST = "www.prabhatasamgiita.org"
export const APEX_PUBLIC_HOST = "prabhatasamgiita.org"

/** Permanent redirect bare apex host to canonical www (SWA serves both hostnames). */
export function apexToWwwRedirectUrl(request: Request): string | null {
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase() ||
    request.headers.get("host")?.split(",")[0]?.trim().toLowerCase()
  if (host !== APEX_PUBLIC_HOST) return null
  const url = new URL(request.url)
  return `https://${CANONICAL_PUBLIC_HOST}${url.pathname}${url.search}`
}

function isInternalSwaHost(host: string) {
  return /^(localhost|127\.0\.0\.1):8080$/i.test(host)
}

function isLoopbackHost(host: string) {
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)
}

function originForHost(host: string, proto: string | undefined) {
  const protocol = proto || (isLoopbackHost(host) ? "http" : "https")
  return `${protocol}://${host}`
}

function envPublicOrigin() {
  const fromRuntime = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!fromRuntime) return null
  try {
    const url = new URL(fromRuntime)
    if (isInternalSwaHost(url.host)) return null
    return url.origin
  } catch {
    return null
  }
}

/** Public origin for redirects. SWA Next standalone often sees request.url as http://localhost:8080. */
export function resolvePublicSiteOriginFromHeaders(headers: Headers, requestUrl?: string) {
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  const hostHeader = headers.get("host")?.split(",")[0]?.trim()
  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim()

  for (const host of [forwardedHost, hostHeader]) {
    if (host && !isInternalSwaHost(host)) {
      return originForHost(host, forwardedProto)
    }
  }

  if (requestUrl) {
    try {
      const url = new URL(requestUrl)
      if (!isInternalSwaHost(url.host)) {
        return url.origin
      }
    } catch {
      // ignore malformed request URLs
    }
  }

  return envPublicOrigin() || DEFAULT_PUBLIC_ORIGIN
}

export function resolvePublicSiteOrigin(request: Request) {
  return resolvePublicSiteOriginFromHeaders(request.headers, request.url)
}

export function publicRedirectUrl(request: Request, path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${resolvePublicSiteOrigin(request)}${normalized}`
}

export function requestIsSecure(request: Request) {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  if (proto) return proto === "https"

  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.split(",")[0]?.trim()
  if (host && !isLoopbackHost(host) && !isInternalSwaHost(host)) {
    return true
  }

  try {
    const url = new URL(request.url)
    if (isInternalSwaHost(url.host)) {
      return process.env.NODE_ENV === "production"
    }
    return url.protocol === "https:"
  } catch {
    return process.env.NODE_ENV === "production"
  }
}

export function isAllowedWebOAuthRedirect(request: Request, redirectUri: string) {
  let parsed: URL
  try {
    parsed = new URL(redirectUri)
  } catch {
    return false
  }
  if (parsed.protocol !== "https:" && !isLoopbackHost(parsed.host)) return false
  if (parsed.pathname !== "/auth/callback/google" && parsed.pathname !== "/auth/callback/facebook") {
    return false
  }

  const allowed = new Set<string>()
  try {
    allowed.add(new URL(resolvePublicSiteOrigin(request)).host)
  } catch {
    // ignore
  }
  const fromEnv = envPublicOrigin()
  if (fromEnv) allowed.add(new URL(fromEnv).host)
  allowed.add("www.prabhatasamgiita.org")
  allowed.add("prabhatasamgiita.org")
  if (parsed.hostname.endsWith(".azurestaticapps.net")) allowed.add(parsed.host)
  if (isLoopbackHost(parsed.host)) allowed.add(parsed.host)
  return allowed.has(parsed.host)
}

export function requestOriginFromHeaders(source: Headers) {
  return resolvePublicSiteOriginFromHeaders(source)
}
