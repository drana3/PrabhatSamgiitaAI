import { KIRTAN_FIXTURES } from "@/lib/fixtures/kirtan"
import { sampleAuthors } from "@/lib/fixtures/authorsGate"
import type { RemoteRecording } from "@/lib/kirtan/remote"
import type {
  AuthorCardData,
  AuthorList,
  AuthorLookup,
  AuthorProfileOwner,
  AuthorProfilePublic,
  AuthorsApi,
  CollectionBrief,
  CreateInput,
  DirectorySort,
  OwnerRecording,
  OwnerResponse,
  OwnerStats,
  PatchInput,
  RecordingPage,
  SlugCheck,
  StatsPeriod,
} from "@/lib/authors/types"
import { localSlugProblem, normalizeSlug } from "@/lib/authors/slug"

/**
 * The author API for the web preview: the same calls as lib/authors/remote.ts, answered from the invented pages
 * (lib/fixtures/authors.ts) and from one in-memory page the person can create. Nothing is sent anywhere. The screens
 * label everything that comes from here "Demo".
 */

/** The demo mirrors the server: route words and the protected names (the server also holds staff-sounding ones for review). */
const RESERVED = new Set([
  "admin", "api", "add-kirtan", "upload-set", "sign-in", "signin", "authors", "author", "about",
  "sitemap", "slug-check", "me", "by-recording", "photo", "recordings", "collections", "report",
  "ananda-murti", "anandamurti", "ananda-marga", "baba", "shrii-shrii-anandamurti", "prabhat-samgiita",
])
const NOW = "2026-11-01T10:00:00Z"

function toRemote(id: string, kind: string, title: string, author: string, type: string, durationSec: number | null, plays: number, addedBy: string): RemoteRecording {
  return {
    id,
    kind: kind as RemoteRecording["kind"],
    type,
    title,
    author,
    added_by: addedBy,
    author_id: null,
    by_author: true,
    status: "published",
    duration_sec: durationSec,
    plays,
    audio_url: "",
    thumbnail_url: null,
    published_at: NOW,
    created_at: NOW,
  }
}

function recordingsOfText(authorText: string): RemoteRecording[] {
  return KIRTAN_FIXTURES.filter((k) => k.author === authorText && k.status === "published").map((k) =>
    toRemote(k.id, k.kind, k.title, k.author, k.type, k.durationSec, k.plays ?? 0, k.addedBy),
  )
}

function card(p: AuthorProfilePublic): AuthorCardData {
  return {
    slug: p.slug,
    display_name: p.display_name,
    author_type: p.author_type,
    bio: p.bio,
    verified: p.verified,
    photo_url: p.photo_url,
    country: p.country,
    monthly_listeners: p.stats?.monthly_listeners ?? null,
    recordings_count: p.recordings_count,
  }
}

function demoStats(days: StatsPeriod): OwnerStats {
  const series = Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.UTC(2026, 10, 1) - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10)
    const plays = 6 + ((i * 7) % 13)
    return { day, plays, listeners: Math.max(1, Math.round(plays * 0.7)) }
  })
  return {
    period_days: days,
    counting_since: "2026-09-01",
    monthly_listeners: 312,
    total_plays: 1840,
    plays_in_period: series.reduce((sum, d) => sum + d.plays, 0),
    public_enough_data: true,
    public_visible: true,
    series,
    top_recordings: [
      { recording_id: "k-bnk-morning", title: "Baba Nam Kevalam, morning round", kind: "kiirtan", plays: 920 },
      { recording_id: "k-bnk-night", title: "Baba Nam Kevalam, slow and soft", kind: "kiirtan", plays: 640 },
    ],
    by_kind: [
      { kind: "kiirtan", count: 1560 },
      { kind: "bhajan", count: 280 },
    ],
    countries: [
      { country: "PL", listeners: 120 },
      { country: "DE", listeners: 64 },
    ],
    notes: ["demo"],
  }
}

export function createDemoApi(): AuthorsApi {
  const authors = [...sampleAuthors().map((a) => ({ ...a }))]
  let mine: AuthorProfileOwner | null = null
  const shown = new Map<string, boolean>()

  const publicOf = (o: AuthorProfileOwner): AuthorProfilePublic => ({
    slug: o.slug,
    display_name: o.display_name,
    author_type: o.author_type,
    bio: o.bio,
    about: o.about,
    country: o.country,
    city: o.city,
    languages: o.languages,
    links: o.links.map((l) => ({ ...l, rel: "nofollow ugc noopener noreferrer" })),
    verified: o.verified,
    kinds: [],
    recordings_count: 0,
    collections_count: 0,
    photo_url: o.photo_url,
    published_at: o.published_at,
    updated_at: o.updated_at,
    stats: { enough_data: false, counting_since: o.published_at?.slice(0, 10) ?? null, monthly_listeners: null, total_plays: null },
    indexable: false,
  })

  const ownerFrom = (input: CreateInput, previous?: AuthorProfileOwner): AuthorProfileOwner => ({
    id: previous?.id ?? "demo-me",
    slug: input.slug,
    display_name: input.display_name,
    author_type: input.author_type,
    bio: input.bio,
    about: input.about,
    country: input.country,
    city: input.city,
    languages: input.languages,
    links: input.links,
    claimed_name: input.claimed_name,
    status: input.publish ? "published" : (previous?.status ?? "draft"),
    review_needed: false,
    review_reason: null,
    verified: false,
    suspended_reason: null,
    include_uploads: input.include_uploads,
    show_stats: input.show_stats,
    photo_url: previous?.photo_url ?? null,
    published_at: input.publish ? NOW : (previous?.published_at ?? null),
    created_at: previous?.created_at ?? NOW,
    updated_at: NOW,
    recordings_count: previous?.recordings_count ?? 0,
    indexable: false,
    slug_change_wait_days: 0,
    reports_count: 0,
    share_path: `/author/${input.slug}`,
  })

  const find = (slug: string) => authors.find((a) => a.profile.slug === slug)

  return {
    demo: true,
    async mine(): Promise<OwnerResponse> {
      return { profile: mine, can_create: true, suspended_reason: null }
    },
    async checkSlug(raw): Promise<SlugCheck> {
      const slug = normalizeSlug(raw)
      const problem = localSlugProblem(slug) ?? (RESERVED.has(slug) ? "reserved" : find(slug) && mine?.slug !== slug ? "taken" : null)
      const base = slug || "author"
      return { slug, available: problem === null, problem, held_for_review: /anandamurti|ananda-marga/.test(slug), suggestions: problem ? [`${base}-music`, `${base}-kiirtan`] : [] }
    },
    async create(input) {
      mine = ownerFrom(input)
      return mine
    },
    async update(patch: PatchInput) {
      if (!mine) throw new Error("no page")
      const merged = { ...mine, ...patch } as unknown as CreateInput
      mine = { ...ownerFrom({ ...merged, publish: mine.status === "published" }, mine), slug: patch.slug ?? mine.slug }
      return mine
    },
    async publish() {
      if (!mine) throw new Error("no page")
      mine = { ...mine, status: "published", published_at: NOW }
      return mine
    },
    async unpublish() {
      if (!mine) throw new Error("no page")
      mine = { ...mine, status: "draft" }
      return mine
    },
    async remove() {
      mine = null
    },
    async putPhoto() {
      if (!mine) throw new Error("no page")
      mine = { ...mine, photo_url: null }
      return mine
    },
    async removePhoto() {
      if (!mine) throw new Error("no page")
      mine = { ...mine, photo_url: null }
      return mine
    },
    async myRecordings(): Promise<{ items: OwnerRecording[]; total: number }> {
      const items = recordingsOfText("Priya Devi").map((recording) => ({ recording, shown: shown.get(recording.id) ?? true, exception: shown.get(recording.id) === false }))
      return { items, total: items.length }
    },
    async setShown(id, value) {
      shown.set(id, value)
    },
    async myStats(days) {
      return demoStats(days)
    },
    async directory({ q, sort = "listeners", offset = 0, limit = 20 }: { q?: string; sort?: DirectorySort; offset?: number; limit?: number }): Promise<AuthorList> {
      const needle = (q ?? "").trim().toLowerCase()
      let list = authors.map((a) => card(a.profile)).filter((c) => !needle || c.display_name.toLowerCase().includes(needle) || c.slug.includes(needle))
      if (sort === "listeners") list = list.sort((a, b) => (b.monthly_listeners ?? -1) - (a.monthly_listeners ?? -1))
      if (sort === "name") list = list.sort((a, b) => a.display_name.localeCompare(b.display_name))
      const page = list.slice(offset, offset + limit)
      return { items: page, total: list.length, limit, offset, has_more: offset + limit < list.length }
    },
    async profile(slug): Promise<AuthorLookup> {
      if (mine && mine.slug === slug && mine.status === "published") return { kind: "profile", profile: publicOf(mine) }
      const found = find(slug)
      return found ? { kind: "profile", profile: found.profile } : { kind: "missing" }
    },
    async recordings(slug, { kind, exclude, offset = 0, limit = 50 }): Promise<RecordingPage> {
      const found = find(slug)
      let items = found ? recordingsOfText(found.authorText) : []
      if (kind) items = items.filter((r) => r.kind === kind)
      if (exclude) items = items.filter((r) => r.id !== exclude)
      return { items: items.slice(offset, offset + limit), total: items.length, limit, offset, has_more: offset + limit < items.length }
    },
    async collections(): Promise<CollectionBrief[]> {
      return [
        { id: "demo-set-1", title: "Autumn dharmacakra (demo)", place: "Warsaw", starts_on: "2026-10-12", ends_on: null, cover_url: null, tracks_count: 3 },
      ]
    },
    async byRecording(id) {
      const found = KIRTAN_FIXTURES.find((k) => k.id === id)
      const owner = found ? authors.find((a) => a.authorText === found.author) : undefined
      return owner ? card(owner.profile) : null
    },
    async report() {
      return { status: "received", message: "Thank you. The team will look at this page." }
    },
  }
}
