/** Numbers and dates on the author pages. Never throws: a runtime without Intl gets plain digits and ISO dates. */

export function formatCount(n: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { notation: n >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n)
  } catch {
    return String(n)
  }
}

/** "1 Sep 2026" in the reader's language, from an ISO date or date-time. */
export function formatDay(iso: string | null | undefined, locale: string): string {
  if (!iso) return ""
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10)
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date)
  } catch {
    return iso.slice(0, 10)
  }
}

/** The host of a link, for showing it ("youtube.com") without the path. */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/** Two-letter country code from the API ("PL"), shown as the region's name when the runtime knows it. */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}
