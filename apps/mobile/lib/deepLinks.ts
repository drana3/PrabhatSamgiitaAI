const WEB_HOSTS = new Set([
  "www.prabhatasamgiita.org",
  "prabhatasamgiita.org",
  "yellow-desert-06a0d4a00.2.azurestaticapps.net",
])

export function songAppPath(songNumber: number): string {
  return `/song/ps-${songNumber}`
}

export function songAppDeepLink(songNumber: number): string {
  return `prabhatai:///song/ps-${songNumber}`
}

function configuredWebHost(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim()
  if (!fromEnv) return null
  try {
    return new URL(fromEnv).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function isPublicWebHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (WEB_HOSTS.has(host)) return true
  const configured = configuredWebHost()
  return configured ? host === configured : false
}

/** Map https song URLs and custom scheme links to Expo Router paths. */
export function webUrlToAppPath(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (!trimmed.includes("://")) {
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    const songPath = path.match(/^\/songs\/(\d+)\/?$/i)
    if (songPath) return songAppPath(Number(songPath[1]))
    return path
  }

  try {
    const url = new URL(trimmed)
    if (url.protocol === "prabhatai:") return null

    if (url.protocol === "https:" || url.protocol === "http:") {
      if (!isPublicWebHost(url.hostname)) return null
      const songMatch = url.pathname.match(/^\/songs\/(\d+)\/?$/i)
      if (songMatch) return `${songAppPath(Number(songMatch[1]))}${url.search}`
      return null
    }
  } catch {
    return null
  }
  return null
}
