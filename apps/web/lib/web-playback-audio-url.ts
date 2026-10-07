import { unwrapArchiveAudioUrl } from "@prabhat/core"

const ARCHIVE_HOSTS = new Set(["prabhatasamgiita.net", "www.prabhatasamgiita.net"])

function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "") ?? ""
}

/** Direct archive links often return an HTML challenge; stream via the member API instead. */
export function webPlaybackAudioUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  if (/\/api\/v1\/media\/stream\?/i.test(trimmed)) return trimmed

  const direct = unwrapArchiveAudioUrl(trimmed)
  let host = ""
  try {
    host = new URL(direct).hostname.toLowerCase()
  } catch {
    return direct
  }
  if (!ARCHIVE_HOSTS.has(host)) return direct

  const apiBase = apiBaseUrl()
  if (!apiBase) return direct
  return `${apiBase}/api/v1/media/stream?url=${encodeURIComponent(direct)}`
}
