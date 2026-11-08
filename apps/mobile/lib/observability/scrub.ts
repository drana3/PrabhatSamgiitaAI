/**
 * Crash-report hygiene, phone side (docs/observability.md). The server has the same rules in
 * apps/api/app/observability.py. Nothing personal may leave in a crash report: e-mail addresses,
 * tokens, signed-URL signatures, the person's words, the device name, the IP address.
 */
export const REDACTED = "[redacted]"

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const BEARER = /\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b/g
const SIGNATURE = /(X-Amz-(?:Signature|Credential|Security-Token)=)[^&\s"']+/gi
const LONG_HEX = /\b[0-9a-fA-F]{40,}\b/g
const QUERY = /\?[^\s"']*/g

export function scrubText(value: string): string {
  return value
    .replace(SIGNATURE, `$1${REDACTED}`)
    .replace(JWT, REDACTED)
    .replace(BEARER, (_m, scheme: string) => `${scheme} ${REDACTED}`)
    .replace(EMAIL, "[email]")
    .replace(LONG_HEX, REDACTED)
}

/** A URL without its query string (it may hold a token or a search), then scrubbed. */
export function scrubUrl(value: string): string {
  return scrubText(value.replace(QUERY, ""))
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTED
  if (typeof value === "string") return scrubText(value)
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1))
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubValue(v, depth + 1)]))
  }
  return value
}

type Loose = Record<string, unknown>

/** `beforeSend` for Sentry: returns the event with personal data removed. Never throws. */
export function scrubEvent<T extends Loose>(event: T): T {
  try {
    const e = event as Loose
    delete e.request // URLs, headers, cookies, bodies
    delete e.server_name // a device name such as "Dada's iPhone"
    if (e.user && typeof e.user === "object") {
      const id = (e.user as Loose).id
      e.user = id ? { id: scrubText(String(id)) } : {}
    }
    for (const key of ["message", "logentry", "transaction", "extra", "tags", "contexts"]) {
      if (key in e) e[key] = scrubValue(e[key])
    }
    const contexts = e.contexts as Loose | undefined
    const device = contexts?.device as Loose | undefined
    if (device) {
      delete device.name
      delete device.device_unique_identifier
      delete device.ip_address
    }
    const exception = e.exception as { values?: Loose[] } | undefined
    for (const item of exception?.values ?? []) {
      if (typeof item.value === "string") item.value = scrubText(item.value)
      const frames = (item.stacktrace as { frames?: Loose[] } | undefined)?.frames
      for (const frame of frames ?? []) delete frame.vars
    }
    const crumbs = Array.isArray(e.breadcrumbs) ? (e.breadcrumbs as Loose[]) : (e.breadcrumbs as { values?: Loose[] } | undefined)?.values
    for (const crumb of crumbs ?? []) scrubBreadcrumb(crumb)
  } catch {
    // if scrubbing itself fails, send less rather than more
    return { ...event, request: undefined, extra: undefined, breadcrumbs: [] } as T
  }
  return event
}

export function scrubBreadcrumb<T extends Loose>(crumb: T): T {
  const c = crumb as Loose
  if (typeof c.message === "string") c.message = scrubUrl(c.message)
  if (c.data && typeof c.data === "object") {
    const data = c.data as Loose
    for (const key of ["url", "to", "from"]) if (typeof data[key] === "string") data[key] = scrubUrl(data[key] as string)
    c.data = scrubValue(c.data)
  }
  return crumb
}
