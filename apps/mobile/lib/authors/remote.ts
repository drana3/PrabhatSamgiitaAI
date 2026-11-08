import { NetworkError, RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"
import type {
  Alias,
  AuthorCardData,
  AuthorList,
  AuthorLookup,
  AuthorProfileOwner,
  AuthorProfilePublic,
  AuthorsApi,
  ClaimList,
  ClaimSearch,
  ClaimStatus,
  ClaimSuggestions,
  ClaimSummary,
  ClaimsCreated,
  CollectionBrief,
  CreateInput,
  DirectoryQuery,
  OwnerRecording,
  OwnerResponse,
  OwnerStats,
  PatchInput,
  PlayBatchResult,
  PlayEventOut,
  RecordingPage,
  ReportOutcome,
  ReportReason,
  SlugCheck,
  StatsPeriod,
} from "@/lib/authors/types"

/**
 * The phone's side of the author API (apps/api `/api/v1/authors`, `/api/v1/plays`; docs/author-profiles.md).
 * Plain `fetch`, no React; the base URL, member headers and `fetch` are passed in, so tests use a fake server.
 * The real wiring is lib/authors/api.ts.
 */

function url(cfg: RemoteConfig, path: string): string {
  return `${cfg.baseUrl.replace(/\/+$/, "")}/api/v1${path}`
}

async function readError(response: Response): Promise<RemoteError> {
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : null
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const d = detail as { code?: string; message?: string }
    return new RemoteError(response.status, d.message ?? `Request failed (${response.status})`, { code: d.code ?? null })
  }
  if (typeof detail === "string" && detail) return new RemoteError(response.status, detail)
  return new RemoteError(response.status, `Request failed (${response.status})`, { code: response.status === 429 ? "rate_limited" : null })
}

type Options = { method?: string; body?: unknown; raw?: { bytes: Blob; contentType: string }; signal?: AbortSignal }

async function send(cfg: RemoteConfig, path: string, opts: Options = {}): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json", ...cfg.headers() }
  let body: BodyInit | undefined
  if (opts.raw) {
    headers["Content-Type"] = opts.raw.contentType
    body = opts.raw.bytes
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json"
    body = JSON.stringify(opts.body)
  }
  try {
    return await (cfg.fetch ?? fetch)(url(cfg, path), { method: opts.method ?? "GET", headers, body, signal: opts.signal })
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : undefined)
  }
}

async function json<T>(cfg: RemoteConfig, path: string, opts: Options = {}): Promise<T> {
  const response = await send(cfg, path, opts)
  if (!response.ok) throw await readError(response)
  return (await response.json()) as T
}

async function nothing(cfg: RemoteConfig, path: string, opts: Options = {}): Promise<void> {
  const response = await send(cfg, path, opts)
  if (!response.ok) throw await readError(response)
}

function query(params: Record<string, string | number | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  return parts.length ? `?${parts.join("&")}` : ""
}

/** Reads a public lookup: 200 is a page, 301 (or a followed redirect handled by the caller) a moved address. */
async function lookup(cfg: RemoteConfig, slug: string): Promise<AuthorLookup> {
  const response = await send(cfg, `/authors/${encodeURIComponent(slug)}`)
  if (response.status === 410) return { kind: "gone" }
  if (response.status === 404) return { kind: "missing" }
  if (response.status === 301 || response.status === 308) {
    let moved: string | null = null
    try {
      const body = (await response.json()) as { detail?: { slug?: string }; slug?: string }
      moved = body.detail?.slug ?? body.slug ?? null
    } catch {
      moved = null
    }
    return moved ? { kind: "moved", slug: moved } : { kind: "missing" }
  }
  if (!response.ok) throw await readError(response)
  const profile = (await response.json()) as AuthorProfilePublic
  // the browser/RN fetch follows a redirect by itself: the page that comes back has the new address
  return profile.slug.toLowerCase() !== slug.toLowerCase() ? { kind: "moved", slug: profile.slug } : { kind: "profile", profile }
}

export function createAuthorsApi(cfg: RemoteConfig): AuthorsApi {
  return {
    demo: false,
    mine: () => json<OwnerResponse>(cfg, "/authors/me").catch(async (error) => {
      // no page yet: the API answers 404 no_profile on some paths; the app treats it as "nothing yet"
      if (error instanceof RemoteError && error.status === 404) return { profile: null, can_create: true, suspended_reason: null }
      throw error
    }),
    checkSlug: (slug) => json<SlugCheck>(cfg, `/authors/slug-check${query({ slug })}`),
    create: (input: CreateInput) => json<AuthorProfileOwner>(cfg, "/authors/me", { method: "POST", body: input }),
    update: (patch: PatchInput) => json<AuthorProfileOwner>(cfg, "/authors/me", { method: "PATCH", body: patch }),
    publish: () => json<AuthorProfileOwner>(cfg, "/authors/me/publish", { method: "POST" }),
    unpublish: () => json<AuthorProfileOwner>(cfg, "/authors/me/unpublish", { method: "POST" }),
    remove: () => nothing(cfg, "/authors/me", { method: "DELETE" }),
    putPhoto: (bytes, contentType) => json<AuthorProfileOwner>(cfg, "/authors/me/photo", { method: "PUT", raw: { bytes, contentType } }),
    removePhoto: () => json<AuthorProfileOwner>(cfg, "/authors/me/photo", { method: "DELETE" }),
    myRecordings: (offset = 0) => json<{ items: OwnerRecording[]; total: number }>(cfg, `/authors/me/recordings${query({ limit: 100, offset })}`),
    setShown: (id, shown) => nothing(cfg, `/authors/me/recordings/${encodeURIComponent(id)}`, { method: "PUT", body: { shown } }),
    myStats: (days: StatsPeriod) => json<OwnerStats>(cfg, `/authors/me/stats${query({ days })}`),
    directory: ({ q, sort, kind, language, offset = 0, limit = 20 }: DirectoryQuery) =>
      json<AuthorList>(cfg, `/authors${query({ q: q?.trim(), sort, kind, language, offset, limit })}`),
    profile: (slug) => lookup(cfg, slug),
    recordings: (slug, { kind, collectionId, exclude, offset = 0, limit = 50 }) =>
      json<RecordingPage>(cfg, `/authors/${encodeURIComponent(slug)}/recordings${query({ kind, collection_id: collectionId, exclude, offset, limit })}`),
    collections: async (slug) => (await json<{ items: CollectionBrief[] }>(cfg, `/authors/${encodeURIComponent(slug)}/collections`)).items,
    byRecording: async (id) => {
      const response = await send(cfg, `/authors/by-recording/${encodeURIComponent(id)}`)
      if (response.status === 404) return null
      if (!response.ok) throw await readError(response)
      const body = (await response.json()) as { profile: AuthorCardData | null }
      return body.profile
    },
    report: (slug, report: { reason: ReportReason; comment?: string }) =>
      json<ReportOutcome>(cfg, `/authors/${encodeURIComponent(slug)}/report`, { method: "POST", body: report }),
    claimSummary: () => json<ClaimSummary>(cfg, "/authors/me/claims/summary"),
    claimSuggestions: () => json<ClaimSuggestions>(cfg, "/authors/me/claims/suggestions"),
    claimSearch: (q, offset = 0) => json<ClaimSearch>(cfg, `/authors/me/claims/search${query({ q: q.trim(), limit: 30, offset })}`),
    createClaims: (recordingIds) => json<ClaimsCreated>(cfg, "/authors/me/claims", { method: "POST", body: { recording_ids: recordingIds } }),
    myClaims: (status?: ClaimStatus) => json<ClaimList>(cfg, `/authors/me/claims${query({ status })}`),
    withdrawClaim: (id) => nothing(cfg, `/authors/me/claims/${encodeURIComponent(id)}`, { method: "DELETE" }),
    aliases: async () => (await json<{ items: Alias[] }>(cfg, "/authors/me/aliases")).items,
    addAlias: async (alias) => (await json<{ items: Alias[] }>(cfg, "/authors/me/aliases", { method: "POST", body: { alias } })).items,
    removeAlias: (key) => nothing(cfg, `/authors/me/aliases/${encodeURIComponent(key)}`, { method: "DELETE" }),
  }
}

/** `POST /plays`: a batch of listening events. `deviceId` is used only when nobody is signed in. */
export async function sendPlays(
  cfg: RemoteConfig,
  batch: { events: PlayEventOut[]; deviceId?: string | null; region?: string | null },
): Promise<PlayBatchResult> {
  return json<PlayBatchResult>(cfg, "/plays", {
    method: "POST",
    body: {
      events: batch.events,
      ...(batch.deviceId ? { device_id: batch.deviceId } : {}),
      ...(batch.region ? { region: batch.region } : {}),
    },
  })
}
