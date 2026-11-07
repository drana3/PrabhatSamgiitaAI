import { runtimeEnv } from "@/lib/runtime-env"

/**
 * Public author pages on the web (docs/author-profiles.md): the server-side reads of the author API and the
 * pure rules that turn a profile into search-engine data (title, description, robots, JSON-LD, sitemap entries).
 * The page itself is app/author/[slug]/page.tsx; this file has no React so tests can run it directly.
 */

export type AuthorKind = "kiirtan" | "bhajan" | "prabhat_samgiita" | "spiritual_song" | "dance_song"

export type AuthorLink = { kind: string; url: string; rel: string }

export type AuthorStats = {
  enough_data: boolean
  counting_since: string | null
  monthly_listeners: number | null
  total_plays: number | null
}

export type AuthorProfile = {
  slug: string
  display_name: string
  author_type: "solo" | "group"
  bio: string
  about: string
  country: string | null
  city: string | null
  languages: string[]
  links: AuthorLink[]
  verified: boolean
  kinds: { kind: string; count: number }[]
  recordings_count: number
  collections_count: number
  photo_url: string | null
  published_at: string | null
  updated_at: string
  stats: AuthorStats | null
  indexable: boolean
}

export type AuthorRecording = {
  id: string
  kind: string
  title: string
  duration_sec: number | null
  audio_url: string
  language: string | null
  year: number | null
  ps_song_number: number | null
  published_at: string | null
}

export type AuthorCollection = {
  id: string
  title: string
  place: string | null
  starts_on: string
  ends_on: string | null
  tracks_count: number
}

export type AuthorCard = {
  slug: string
  display_name: string
  author_type: "solo" | "group"
  bio: string
  verified: boolean
  photo_url: string | null
  country: string | null
  monthly_listeners: number | null
  recordings_count: number
}

export type AuthorPageData =
  | { kind: "profile"; profile: AuthorProfile; recordings: AuthorRecording[]; collections: AuthorCollection[] }
  | { kind: "moved"; slug: string }
  | { kind: "gone" }
  | { kind: "missing" }
  | { kind: "error" }

export const AUTHOR_PAGE_SIZE = 50
export const SITE_NAME = "Prabhat Samgiita"
export const DEFAULT_SITE_ORIGIN = "https://www.prabhatasamgiita.org"

function apiBase(): string {
  return (runtimeEnv("API_BASE_URL") ?? runtimeEnv("NEXT_PUBLIC_API_BASE_URL") ?? "http://localhost:8000").replace(/\/+$/, "")
}

/** The API address a visitor's browser can reach (pictures and audio), not the private one the server may use. */
function publicApiBase(): string {
  return (runtimeEnv("NEXT_PUBLIC_API_BASE_URL") ?? apiBase()).replace(/\/+$/, "")
}

export function siteOrigin(): string {
  const fromEnv = runtimeEnv("NEXT_PUBLIC_SITE_URL")
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin
    } catch {
      // fall through to the default
    }
  }
  return DEFAULT_SITE_ORIGIN
}

export function authorPath(slug: string): string {
  return `/author/${encodeURIComponent(slug)}`
}

export function authorUrl(slug: string): string {
  return `${siteOrigin()}${authorPath(slug)}`
}

/** A picture path of the API made absolute; null when there is none. */
export function authorPhotoUrl(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null
  return /^https?:\/\//i.test(photoUrl) ? photoUrl : `${publicApiBase()}${photoUrl.startsWith("/") ? "" : "/"}${photoUrl}`
}

async function getJson<T>(path: string, revalidate = 60): Promise<{ status: number; body: T | null }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(`${apiBase()}/api/v1${path}`, {
      redirect: "manual",
      next: { revalidate },
      signal: controller.signal,
    })
    let body: T | null = null
    if (response.status === 200 || response.status === 301 || response.status === 308) {
      try {
        body = (await response.json()) as T
      } catch {
        body = null
      }
    }
    return { status: response.status, body }
  } catch {
    return { status: 0, body: null }
  } finally {
    clearTimeout(timeout)
  }
}

/** Everything one author page needs. A slug that moved answers `moved` so the page can redirect permanently. */
export async function fetchAuthorPage(slug: string): Promise<AuthorPageData> {
  const found = await getJson<AuthorProfile & { slug: string }>(`/authors/${encodeURIComponent(slug)}`)
  if (found.status === 404) return { kind: "missing" }
  if (found.status === 410) return { kind: "gone" }
  if (found.status === 301 || found.status === 308) {
    const moved = (found.body as { slug?: string } | null)?.slug
    return moved ? { kind: "moved", slug: moved } : { kind: "missing" }
  }
  if (found.status !== 200 || !found.body) return { kind: "error" }
  const profile = found.body
  const [recordings, collections] = await Promise.all([
    getJson<{ items: AuthorRecording[] }>(`/authors/${encodeURIComponent(profile.slug)}/recordings?limit=${AUTHOR_PAGE_SIZE}`),
    getJson<{ items: AuthorCollection[] }>(`/authors/${encodeURIComponent(profile.slug)}/collections`),
  ])
  return {
    kind: "profile",
    profile,
    recordings: recordings.body?.items ?? [],
    collections: collections.body?.items ?? [],
  }
}

/** The directory (a page for search engines and people); `null` when the API cannot be reached. */
export async function fetchAuthorDirectory(offset = 0, limit = 60): Promise<{ items: AuthorCard[]; total: number } | null> {
  const result = await getJson<{ items: AuthorCard[]; total: number }>(`/authors?sort=listeners&limit=${limit}&offset=${offset}`, 300)
  return result.status === 200 && result.body ? result.body : null
}

/** Addresses for sitemap.xml: only published pages with a recording that are not waiting for the team. */
export async function fetchAuthorSitemap(): Promise<{ slug: string; updated_at: string }[]> {
  const result = await getJson<{ items: { slug: string; updated_at: string }[] }>("/authors/sitemap", 300)
  return result.status === 200 && result.body ? result.body.items : []
}

// ---------------------------------------------------------------------------- search-engine data

const KIND_LABEL: Record<string, string> = {
  kiirtan: "Kiirtan",
  bhajan: "Bhajan",
  prabhat_samgiita: "Prabhat Samgiita",
  spiritual_song: "Spiritual song",
  dance_song: "Dance song",
}

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind
}

export function kindLabelPlural(kind: string): string {
  return kind === "prabhat_samgiita" ? "Prabhat Samgiita" : `${kindLabel(kind)}s`
}

/** What is on the page in a few words, from the kinds the author has: "Kiirtans and bhajans". */
export function kindsSentence(kinds: { kind: string; count: number }[]): string {
  const names = kinds.filter((k) => k.count > 0).map((k) => (k.kind === "prabhat_samgiita" ? kindLabelPlural(k.kind) : kindLabelPlural(k.kind).toLowerCase()))
  if (names.length === 0) return "Recordings"
  const joined = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
  return joined.replace(/^./, (c) => c.toUpperCase())
}

function lowerFirst(text: string): string {
  return /^Prabhat Samgiita/.test(text) ? text : text.replace(/^./, (c) => c.toLowerCase())
}

export function authorTitle(profile: Pick<AuthorProfile, "display_name" | "kinds">): string {
  const name = profile.display_name.trim()
  return profile.kinds.some((k) => k.count > 0) ? `${name}: ${kindsSentence(profile.kinds)} | ${SITE_NAME}` : `${name} | ${SITE_NAME}`
}

export function authorDescription(profile: Pick<AuthorProfile, "display_name" | "bio" | "kinds" | "recordings_count">): string {
  const bio = profile.bio.trim().replace(/\s+/g, " ")
  if (bio) return bio.length > 200 ? `${bio.slice(0, 197).trimEnd()}...` : bio
  if (profile.recordings_count > 0) {
    const n = profile.recordings_count
    return `Listen to ${n} ${n === 1 ? "recording" : "recordings"} by ${profile.display_name}: ${lowerFirst(kindsSentence(profile.kinds))}, on ${SITE_NAME}.`
  }
  return `${profile.display_name} on ${SITE_NAME}.`
}

/** Robots meta of a page: only an indexable profile is listed; everything else says noindex. */
export function authorRobots(indexable: boolean): { index: boolean; follow: boolean } {
  return indexable ? { index: true, follow: true } : { index: false, follow: false }
}

/** ISO 8601 duration of a track length in seconds ("PT3M25S"); undefined when unknown. */
export function isoDuration(seconds: number | null | undefined): string | undefined {
  if (!seconds || seconds <= 0) return undefined
  const total = Math.round(seconds)
  return `PT${Math.floor(total / 60)}M${total % 60}S`
}

/** A link the page may offer: https only, and nothing the API did not already clean. Defence in depth. */
export function safeHttpsUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    return url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

const LANGUAGE_NAME: Record<string, string> = {
  bengali: "Bengali",
  sanskrit: "Sanskrit",
  hindi: "Hindi",
  english: "English",
  spanish: "Spanish",
  russian: "Russian",
  other: "Other",
}

export function languageName(code: string): string {
  return LANGUAGE_NAME[code] ?? code
}

const LANGUAGE_CODE: Record<string, string> = { bengali: "bn", sanskrit: "sa", hindi: "hi", english: "en", spanish: "es", russian: "ru" }

/** The JSON-LD of a page: the author (Person or MusicGroup) and up to AUTHOR_PAGE_SIZE recordings of them. */
export function authorJsonLd(profile: AuthorProfile, recordings: AuthorRecording[]): Record<string, unknown> {
  const url = authorUrl(profile.slug)
  const id = `${url}#author`
  const photo = authorPhotoUrl(profile.photo_url)
  const sameAs = profile.links.map((l) => safeHttpsUrl(l.url)).filter((u): u is string => Boolean(u))
  const author: Record<string, unknown> = {
    "@type": profile.author_type === "group" ? "MusicGroup" : "Person",
    "@id": id,
    name: profile.display_name,
    url,
    ...(profile.bio ? { description: profile.bio } : {}),
    ...(photo ? { image: photo } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(profile.country ? { homeLocation: { "@type": "Place", name: [profile.city, profile.country].filter(Boolean).join(", ") } } : {}),
    ...(profile.author_type === "solo" ? { jobTitle: "Singer" } : {}),
  }
  const tracks = recordings.slice(0, AUTHOR_PAGE_SIZE).map((r) => ({
    "@type": "MusicRecording",
    "@id": `${url}#recording-${r.id}`,
    name: r.title,
    url: `${url}#recording-${r.id}`,
    byArtist: { "@id": id },
    ...(isoDuration(r.duration_sec) ? { duration: isoDuration(r.duration_sec) } : {}),
    ...(r.language && LANGUAGE_CODE[r.language] ? { inLanguage: LANGUAGE_CODE[r.language] } : {}),
    ...(r.year ? { datePublished: String(r.year) } : {}),
  }))
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": `${url}#page`,
        url,
        name: profile.display_name,
        ...(profile.published_at ? { datePublished: profile.published_at } : {}),
        dateModified: profile.updated_at,
        mainEntity: { "@id": id },
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: siteOrigin() },
      },
      author,
      ...tracks,
    ],
  }
}

/** JSON for a <script type="application/ld+json">: `<` is escaped so a name can never close the tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return ""
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n)
}
