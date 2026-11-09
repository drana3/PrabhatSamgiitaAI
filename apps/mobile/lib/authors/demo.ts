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
  DirectoryQuery,
  OwnerRecording,
  OwnerResponse,
  OwnerStats,
  PatchInput,
  RecordingPage,
  SlugCheck,
  StatsPeriod,
} from "@/lib/authors/types"
import { localSlugProblem, normalizeSlug } from "@/lib/authors/slug"
import { createDemoClaims, type DemoClaims } from "@/lib/authors/demoClaims"
import { setDemoSignedOut } from "@/lib/authors/demoSession"
import { NetworkError, RemoteError } from "@/lib/kirtan/remote"

/**
 * The author API for the web preview: the same calls as lib/authors/remote.ts, answered from the invented pages
 * (lib/fixtures/authors.ts) and from one in-memory page the person can create. Nothing is sent anywhere. The screens
 * label everything that comes from here "Demo".
 */

/** The demo mirrors the server: route words and the protected names (the server also holds staff-sounding ones for review). */
const RESERVED = new Set([
  "admin", "api", "add-kirtan", "add-mantra", "upload-set", "sign-in", "signin", "authors", "author", "about",
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

export type DemoStatsMode = "normal" | "small" | "empty"

/** A small invented picture, so "add a photo" shows something in the preview. */
const DEMO_PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#B84A0C"/><circle cx="60" cy="46" r="20" fill="#F4E4D6"/><path d="M20 120c4-26 22-40 40-40s36 14 40 40z" fill="#F4E4D6"/></svg>',
  )

function demoStats(days: StatsPeriod, mode: DemoStatsMode = "normal"): OwnerStats {
  if (mode !== "normal") {
    const small = mode === "small"
    return {
      period_days: days,
      counting_since: small ? "2026-10-20" : null,
      monthly_listeners: small ? 3 : 0,
      total_plays: small ? 4 : 0,
      plays_in_period: small ? 4 : 0,
      public_enough_data: false,
      public_visible: true,
      series: Array.from({ length: days }, (_, i) => ({
        day: new Date(Date.UTC(2026, 10, 1) - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10),
        plays: small && i > days - 4 ? 1 : 0,
        listeners: small && i > days - 4 ? 1 : 0,
      })),
      top_recordings: small ? [{ recording_id: "k-bnk-morning", title: "Baba Nam Kevalam, morning round", kind: "kiirtan", plays: 4 }] : [],
      by_kind: small ? [{ kind: "kiirtan", count: 4 }] : [],
      countries: null,
      notes: small ? ["not_enough_data", "counting_rule"] : ["no_data_yet", "counting_rule"],
    }
  }
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

/**
 * Switches for the preview and the tests: put the demo into any state a real account can be in (suspended, reported,
 * few listeners, a failing network) without a server. Reachable in the browser as `globalThis.__authorsDemo`.
 */
export type DemoControl = {
  reset(): void
  /** a page of the person's own, by fields; `null` removes it */
  setMine(patch: Partial<AuthorProfileOwner> | null): void
  /** the account cannot make a page (the team suspended it) */
  setBlocked(reason: string | null): void
  setStats(mode: DemoStatsMode): void
  setRecordings(mode: "some" | "none"): void
  /** the next call of this API method fails once: "network", "server" or an API error code */
  failNext(method: keyof AuthorsApi, how: "network" | "server" | string): void
  /** the public address answers "moved" (to `to`) or "gone" */
  setLookup(slug: string, answer: { moved: string } | "gone" | null): void
  setReport(outcome: "received" | "already_reported"): void
  /** show the signed-out screens (read when a screen opens) */
  setSignedIn(value: boolean): void
  /** the library has recordings that may be the person's ("some") or none */
  setClaimLibrary(mode: "some" | "none"): void
  /** the person's claims, by recording id and status */
  setClaims(rows: Parameters<DemoClaims["setClaims"]>[0]): void
}

export type DemoAuthorsApi = AuthorsApi & { control: DemoControl }

export function createDemoApi(): DemoAuthorsApi {
  // the counts follow the sample recordings, so the page and the list never disagree
  const authors = sampleAuthors().map((a) => {
    const rows = recordingsOfText(a.authorText)
    const kinds = [...new Set(rows.map((r) => r.kind))].map((kind) => ({ kind, count: rows.filter((r) => r.kind === kind).length }))
    return { ...a, profile: { ...a.profile, id: a.profile.id ?? `demo-author-${a.profile.slug}`, recordings_count: rows.length, kinds } }
  })
  let mine: AuthorProfileOwner | null = null
  let shown = new Map<string, boolean>()
  let statsMode: DemoStatsMode = "normal"
  let recordingsMode: "some" | "none" = "some"
  let blocked: string | null | undefined
  let reportOutcome: "received" | "already_reported" = "received"
  const claims = createDemoClaims(() => mine)
  const failures = new Map<string, Error>()
  const lookups = new Map<string, { moved: string } | "gone">()

  const publicOf = (o: AuthorProfileOwner): AuthorProfilePublic => ({
    id: o.id,
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
    stats: o.show_stats ? { enough_data: false, counting_since: o.published_at?.slice(0, 10) ?? null, monthly_listeners: null, total_plays: null } : null,
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

  // a page answers to its address and to its id (the shared link may carry either)
  const find = (key: string) => authors.find((a) => a.profile.slug === key || a.profile.id === key)

  const base: AuthorsApi = {
    demo: true,
    async mine(): Promise<OwnerResponse> {
      return { profile: mine, can_create: blocked === undefined, suspended_reason: blocked ?? null }
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
      mine = { ...mine, photo_url: DEMO_PHOTO }
      return mine
    },
    async removePhoto() {
      if (!mine) throw new Error("no page")
      mine = { ...mine, photo_url: null }
      return mine
    },
    async myRecordings(): Promise<{ items: OwnerRecording[]; total: number }> {
      const items = (recordingsMode === "none" ? [] : recordingsOfText("Priya Devi")).map((recording) => ({ recording, shown: shown.get(recording.id) ?? true, exception: shown.get(recording.id) === false }))
      return { items, total: items.length }
    },
    async setShown(id, value) {
      shown.set(id, value)
    },
    async myStats(days) {
      return demoStats(days, statsMode)
    },
    async directory({ q, sort = "listeners", kind, language, offset = 0, limit = 20 }: DirectoryQuery): Promise<AuthorList> {
      const needle = (q ?? "").trim().toLowerCase()
      const everyone = mine && mine.status === "published" ? [...authors, { authorText: "", profile: { ...publicOf(mine), kinds: [] } }] : authors
      const shownAuthors = everyone.filter((a) => (!kind || a.profile.kinds.some((k) => k.kind === kind)) && (!language || a.profile.languages.includes(language)))
      let list = shownAuthors.map((a) => card(a.profile)).filter((c) => !needle || c.display_name.toLowerCase().includes(needle) || c.slug.includes(needle))
      if (sort === "listeners") list = list.sort((a, b) => (b.monthly_listeners ?? -1) - (a.monthly_listeners ?? -1))
      if (sort === "name") list = list.sort((a, b) => a.display_name.localeCompare(b.display_name))
      if (sort === "new") list = list.sort((a, b) => (everyone.find((x) => x.profile.slug === b.slug)?.profile.published_at ?? "").localeCompare(everyone.find((x) => x.profile.slug === a.slug)?.profile.published_at ?? ""))
      const page = list.slice(offset, offset + limit)
      return { items: page, total: list.length, limit, offset, has_more: offset + limit < list.length }
    },
    async profile(slug): Promise<AuthorLookup> {
      const moved = lookups.get(slug)
      if (moved === "gone") return { kind: "gone" }
      if (moved) return { kind: "moved", slug: moved.moved }
      if (mine && (mine.slug === slug || mine.id === slug) && mine.status === "published") return { kind: "profile", profile: publicOf(mine) }
      const found = find(slug)
      return found ? { kind: "profile", profile: found.profile } : { kind: "missing" }
    },
    async recordings(slug, { kind, exclude, offset = 0, limit = 50 }): Promise<RecordingPage> {
      const found = find(slug)
      let items = found ? recordingsOfText(found.authorText) : []
      if (kind) items = items.filter((r) => r.kind === kind)
      if (exclude) items = items.filter((r) => r.id !== exclude)
      // numbers switched off on the page: the server sends no play counts at all
      if (found && !found.profile.stats) items = items.map((r) => ({ ...r, plays: null }))
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
      return { status: reportOutcome, message: "Thank you. The team will look at this page." }
    },
    ...claims.api,
  }

  const control: DemoControl = {
    reset() {
      mine = null
      shown = new Map()
      statsMode = "normal"
      recordingsMode = "some"
      blocked = undefined
      reportOutcome = "received"
      failures.clear()
      lookups.clear()
      claims.reset()
      setDemoSignedOut(false)
    },
    setMine(patch) {
      mine = patch === null ? null : { ...ownerFrom({ slug: "my-page", display_name: "My Page", author_type: "solo", bio: "", about: "", country: null, city: null, languages: [], links: [], claimed_name: null, include_uploads: "all", show_stats: true, publish: true }, mine ?? undefined), ...patch }
    },
    setBlocked(reason) {
      blocked = reason === null ? undefined : reason
    },
    setStats(mode) {
      statsMode = mode
    },
    setRecordings(mode) {
      recordingsMode = mode
    },
    failNext(method, how) {
      failures.set(method, how === "network" ? new NetworkError() : how === "server" ? new RemoteError(500, "demo") : new RemoteError(400, "demo", { code: how }))
    },
    setLookup(slug, answer) {
      if (answer === null) lookups.delete(slug)
      else lookups.set(slug, answer)
    },
    setReport(outcome) {
      reportOutcome = outcome
    },
    setSignedIn(value) {
      setDemoSignedOut(!value)
    },
    setClaimLibrary(mode) {
      claims.setMode(mode)
    },
    setClaims(rows) {
      claims.setClaims(rows)
    },
  }

  // every method fails once when the preview or a test asked for it
  const guarded = { demo: true } as unknown as Record<string, unknown>
  for (const [name, value] of Object.entries(base)) {
    guarded[name] =
      typeof value === "function"
        ? async (...args: unknown[]) => {
            const failure = failures.get(name)
            if (failure) {
              failures.delete(name)
              throw failure
            }
            return (value as (...a: unknown[]) => unknown)(...args)
          }
        : value
  }
  return Object.assign(guarded as unknown as AuthorsApi, { control })
}
