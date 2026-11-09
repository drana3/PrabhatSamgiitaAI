import { isIP } from "node:net"

/**
 * The visitor's address as the hosting platform saw it, for the API's request limiter.
 *
 * `X-Forwarded-For` is a list: whatever the visitor typed first, then one entry added by each proxy in
 * front of this server. Only the entries the platform added can be trusted, so count `hops` from the
 * RIGHT (WEB_TRUSTED_PROXY_HOPS, default 1: one platform proxy in front). Everything to the left is
 * visitor-controlled and is never passed on. Returns undefined when there is no usable address.
 */
export function trustedClientIp(forwardedFor: string | null | undefined, hops = 1): string | undefined {
  if (!forwardedFor || !Number.isInteger(hops) || hops < 1) return undefined
  const parts = forwardedFor
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length < hops) return undefined
  const candidate = stripPort(parts[parts.length - hops])
  return isIP(candidate) ? candidate : undefined
}

function stripPort(value: string): string {
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(value)
  if (bracketed) return bracketed[1]
  // "1.2.3.4:5678" has one colon; a bare IPv6 address has several and no port
  if (/^[^:]+:\d+$/.test(value)) return value.slice(0, value.lastIndexOf(":"))
  return value
}

/** How many proxies of the platform sit in front of this server (default 1). */
export function trustedProxyHops(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 1
}
