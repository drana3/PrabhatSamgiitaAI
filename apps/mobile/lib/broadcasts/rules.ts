import { linkCount, stripInvisible } from "@/lib/songComments/rules"

import { parseVideoUrl } from "@/lib/recordingVideos/rules"

import type { Broadcast, BroadcastFailure, BroadcastProvider } from "./types"

/**
 * What the phone checks before anything is sent (the server checks again and decides): the same limits and the same
 * link rules as apps/api services/broadcasts.py. A link is PARSED with `new URL()` and its host compared whole or by
 * its real domain suffix; never matched as text (`zoom.us.evil.com`, `https://zoom.us@evil.com/` and `evilzoom.us` all
 * get past a text match). Never fetched.
 */
export const TITLE_MIN = 3
export const TITLE_MAX = 120
export const URL_MAX = 500
export const DESCRIPTION_MAX = 1000
export const ORGANIZER_MAX = 120
export const STARTED_AGO_MAX_HOURS = 6
export const FAR_AHEAD_DAYS = 365

const ZOOM_DOMAINS = ["zoom.us", "zoom.com", "zoomgov.com"]
const FACEBOOK_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.watch"])
const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"])
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtube-nocookie.com"])
/** Names a person's own machine or network answers to: never a public broadcast. */
const PRIVATE_TLDS = new Set(["local", "localhost", "internal", "lan", "home", "corp", "intranet", "test", "invalid", "arpa"])

function trimChar(text: string, ch: string, side: "start" | "end"): string {
  let from = 0
  let to = text.length
  if (side === "start") while (from < to && text[from] === ch) from += 1
  else while (to > from && text[to - 1] === ch) to -= 1
  return text.slice(from, to)
}

/** The part of a link between `://` and the first `/`, `?` or `#`: where the host is. */
function authorityOf(candidate: string): string {
  const rest = candidate.slice(candidate.indexOf("://") + 3)
  const ends = ["/", "?", "#"].map((ch) => rest.indexOf(ch)).filter((i) => i >= 0)
  return ends.length ? rest.slice(0, Math.min(...ends)) : rest
}

const underDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`)
const isDigit = (ch: string) => ch >= "0" && ch <= "9"
const isLabelChar = (ch: string) => (ch >= "a" && ch <= "z") || isDigit(ch) || ch === "-"

/** An IPv4 number (`10.0.0.1`, `127.1`, `0x7f.1`) or an IPv6 one: never a public broadcast address. */
function looksLikeIp(host: string): boolean {
  if (host.includes(":") || host.startsWith("[")) return true
  const last = host.split(".").pop() ?? ""
  // a last label of digits (or a hex number) is an IP number in the eyes of every URL parser
  return last !== "" && (Array.from(last).every(isDigit) || (last.startsWith("0x") && last.length > 2))
}

/** A public domain name: dot-separated ASCII labels of letters, digits and hyphens, at least two labels, no private ending. */
function publicHost(host: string): boolean {
  if (!host || host.length > 253 || looksLikeIp(host)) return false
  const labels = host.split(".")
  if (labels.length < 2) return false
  if (PRIVATE_TLDS.has(labels[labels.length - 1] as string)) return false
  return labels.every((label) => label.length > 0 && label.length <= 63 && !label.startsWith("-") && !label.endsWith("-") && Array.from(label).every(isLabelChar))
}

export type ParsedBroadcastLink = { ok: true; provider: BroadcastProvider; host: string; url: string } | { ok: false; failure: BroadcastFailure }

const bad = (failure: BroadcastFailure): { ok: false; failure: BroadcastFailure } => ({ ok: false, failure })

function providerOf(host: string): BroadcastProvider {
  if (ZOOM_DOMAINS.some((domain) => underDomain(host, domain))) return "zoom"
  if (FACEBOOK_HOSTS.has(host)) return "facebook"
  if (INSTAGRAM_HOSTS.has(host)) return "instagram"
  return "other"
}

export function parseBroadcastLink(raw: string): ParsedBroadcastLink {
  const text = stripInvisible(raw ?? "").trim()
  if (!text) return bad("empty")
  if (text.length > URL_MAX + 200) return bad("tooLong")
  if (Array.from(text).some((ch) => ch.trim() === "" || ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 || ch === "\\")) return bad("badLink")
  let candidate = text
  if (!text.includes("://")) {
    const first = text.split("/", 1)[0] as string
    if (first.includes(":") && !Array.from(first.slice(first.lastIndexOf(":") + 1)).every(isDigit)) return bad("notHttps")
    candidate = `https://${trimChar(text, "/", "start")}`
  }
  // a non-ASCII host is refused as it was typed (URL would turn it into punycode and let it through)
  const authority = authorityOf(candidate)
  if (Array.from(authority).some((ch) => ch.charCodeAt(0) > 127)) return bad("notPublic")
  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return bad("badLink")
  }
  if (parsed.protocol !== "https:") return bad("notHttps")
  if (parsed.username || parsed.password) return bad("badLink")
  if (parsed.port && parsed.port !== "443") return bad("badLink")
  const host = trimChar(parsed.hostname.toLowerCase(), ".", "end")
  if (!publicHost(host)) return bad("notPublic")

  if (YOUTUBE_HOSTS.has(host)) {
    const video = parseVideoUrl(candidate)
    return video.ok && video.provider === "youtube" ? { ok: true, provider: "youtube", host: "youtube.com", url: video.url } : bad("channel")
  }
  const path = parsed.pathname || "/"
  if (path === "/" && !parsed.search) return bad("bareSite")
  const url = `https://${host}${path}${parsed.search}`
  if (url.length > URL_MAX) return bad("tooLong")
  return { ok: true, provider: providerOf(host), host, url }
}

/**
 * A stored address is never trusted: before it is opened outside the app it is parsed again, and only an address the
 * parser gives back unchanged is opened. Returns the address to open, or null.
 */
export function addressToOpen(url: string): string | null {
  const parsed = parseBroadcastLink(url)
  return parsed.ok && parsed.url === url ? parsed.url : null
}

/** Only a YouTube broadcast ever plays inside the app (through the site's own embed); Zoom and every other site never. */
export const playsInApp = (provider: BroadcastProvider): boolean => provider === "youtube"

function hasLatinOnlyLetters(text: string): boolean {
  return Array.from(text).every((ch) => !/\p{L}/u.test(ch) || /\p{Script=Latin}/u.test(ch))
}

const oneLine = (raw: string, max: number) => stripInvisible(raw ?? "").split(/\s+/).filter(Boolean).join(" ").slice(0, max + 40)

export function cleanBroadcastTitle(raw: string): { ok: true; title: string } | { ok: false; failure: BroadcastFailure } {
  const title = oneLine(raw, TITLE_MAX)
  if (title.length < TITLE_MIN) return { ok: false, failure: "titleShort" }
  if (title.length > TITLE_MAX) return { ok: false, failure: "titleLong" }
  if (!hasLatinOnlyLetters(title)) return { ok: false, failure: "titleLatin" }
  if (linkCount(title) > 0) return { ok: false, failure: "titleLink" }
  return { ok: true, title }
}

/** The description or the organizer: empty is none, a link in it is not allowed (the link goes in its own field). */
export function cleanBroadcastText(raw: string, max: number): { ok: true; text: string | null } | { ok: false; failure: BroadcastFailure } {
  const text = stripInvisible(raw ?? "").split("\n").map((line) => line.split(/\s+/).filter(Boolean).join(" ")).join("\n").trim()
  if (!text) return { ok: true, text: null }
  if (text.length > max) return { ok: false, failure: "tooLong" }
  if (linkCount(text) > 0) return { ok: false, failure: "textLink" }
  return { ok: true, text }
}

const pad = (n: number) => String(n).padStart(2, "0")

/** The device's own zone name (an IANA name such as Europe/Berlin), or null where the engine does not know it. */
export function deviceZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

/**
 * The start the person typed (a date `YYYY-MM-DD` and a time `HH:MM`, both in the phone's own zone) as the API takes it: a
 * local date-time without an offset plus the zone's name. Not further than a year ahead, and not more than six hours ago
 * (somebody who posts a link a little late). Nothing typed at all is "no start": the broadcast counts as live from now.
 */
export function resolveStart(
  input: { date: string; time: string },
  options: { now?: number; zone?: string | null } = {},
): { ok: true; startsAt: string | null; timezone: string | null } | { ok: false; failure: BroadcastFailure } {
  const date = (input.date ?? "").trim()
  const time = (input.time ?? "").trim()
  if (!date && !time) return { ok: true, startsAt: null, timezone: null }
  const [y = "", mo = "", d = "", ...extraDate] = date.split("-")
  const [h = "", mi = "", ...extraTime] = time.split(":")
  const parts = [y, mo, d, h, mi]
  if (extraDate.length || extraTime.length || parts.some((p) => p === "" || !Array.from(p).every(isDigit)) || y.length !== 4 || mo.length > 2 || d.length > 2 || h.length > 2 || mi.length !== 2) {
    return { ok: false, failure: "startBad" }
  }
  const [year, month, day, hour, minute] = parts.map(Number) as [number, number, number, number, number]
  const moment = new Date(year, month - 1, day, hour, minute)
  // 31 February or 25:00 roll over into another day: not a time
  if (moment.getFullYear() !== year || moment.getMonth() !== month - 1 || moment.getDate() !== day || moment.getHours() !== hour || moment.getMinutes() !== minute) {
    return { ok: false, failure: "startBad" }
  }
  const now = options.now ?? Date.now()
  if (moment.getTime() < now - STARTED_AGO_MAX_HOURS * 3_600_000) return { ok: false, failure: "startPast" }
  if (moment.getTime() > now + FAR_AHEAD_DAYS * 86_400_000) return { ok: false, failure: "startFar" }
  const zone = options.zone === undefined ? deviceZone() : options.zone
  if (!zone) return { ok: false, failure: "startBad" }
  return { ok: true, startsAt: `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`, timezone: zone }
}

/** What the page says about a broadcast right now: the server's own phase can be minutes old, so it is worked out again from the times. */
export function phaseNow(b: Pick<Broadcast, "startsAt" | "endsAt" | "createdAt">, now: number = Date.now()): "upcoming" | "now" | "ended" {
  if (now >= Date.parse(b.endsAt)) return "ended"
  const begins = b.startsAt ? Date.parse(b.startsAt) : Date.parse(b.createdAt)
  return now < begins ? "upcoming" : "now"
}

/** The shelf of the Kiirtan screen: live ones first, then the soonest upcoming; an ended one never stays on it. */
export function shelfOrder(items: readonly Broadcast[], now: number = Date.now()): Broadcast[] {
  const live = items.filter((b) => b.status === "published" && phaseNow(b, now) !== "ended")
  const begin = (b: Broadcast) => (b.startsAt ? Date.parse(b.startsAt) : Date.parse(b.createdAt))
  const rank = (b: Broadcast) => (phaseNow(b, now) === "now" ? 0 : 1)
  return [...live].sort((a, b) => rank(a) - rank(b) || begin(a) - begin(b))
}

/** The thumbnail is shown only from YouTube's own image host over https; any other address is not loaded. */
export function safeThumbnail(url: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.port && parsed.hostname === "i.ytimg.com" ? url : null
  } catch {
    return null
  }
}

/** A day as the form writes it, `YYYY-MM-DD` in the phone's own zone: today, or some days on (the "Today" and "Tomorrow" chips). */
export function localDateString(daysFromNow: number, now: number = Date.now()): string {
  const day = new Date(now)
  day.setDate(day.getDate() + daysFromNow)
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}
