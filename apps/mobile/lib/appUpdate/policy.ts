/**
 * Forced and recommended updates, phone side (docs/forced-update.md).
 *
 * The server says "required" (this version is below the minimum: full-screen stop), "recommended"
 * (a dismissible banner) or "ok". Rules that keep this from locking people out by mistake:
 *
 * - A network failure, a server error or an unreadable answer means "ok" ... unless the last good answer for
 *   THIS app version was "required": then the stop stays, even offline.
 * - The saved answer belongs to one app version; after an update it is dropped.
 * - "Recommended" can be dismissed; it comes back only when the server recommends a newer version.
 *
 * Pure TypeScript with everything injected, so tests use fakes.
 */
export type UpdateStatus = "ok" | "recommended" | "required"

export type UpdateAnswer = {
  status: UpdateStatus
  minimumVersion: string | null
  recommendedVersion: string | null
  storeUrl: string | null
}

export const OK: UpdateAnswer = {
  status: "ok",
  minimumVersion: null,
  recommendedVersion: null,
  storeUrl: null,
}

export type UpdateStorage = {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<void>
}

export type UpdateDeps = {
  /** full URL of GET /api/v1/app/version-status; empty = never ask (preview builds) */
  endpoint: string | undefined
  fetch: typeof fetch
  appVersion: string | undefined
  platform: string | undefined
  storage: UpdateStorage
  timeoutMs?: number
}

const ANSWER_KEY = "prabhat-update-answer"
const DISMISSED_KEY = "prabhat-update-dismissed"
const STORE_HOSTS = ["apps.apple.com", "itunes.apple.com", "play.google.com", "market.android.com"]

/** Only an https link to a store may be opened from a button. */
export function safeStoreUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  const match = /^https:\/\/([^/:@?#]+)(\/|$)/.exec(value.trim())
  if (!match || !STORE_HOSTS.includes(match[1].toLowerCase())) return null
  return value.trim()
}

function parseAnswer(value: unknown): UpdateAnswer | null {
  if (typeof value !== "object" || value === null) return null
  const raw = value as Record<string, unknown>
  if (raw.status !== "ok" && raw.status !== "recommended" && raw.status !== "required") return null
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
  return {
    status: raw.status,
    minimumVersion: text(raw.minimum_version ?? raw.minimumVersion),
    recommendedVersion: text(raw.recommended_version ?? raw.recommendedVersion),
    storeUrl: safeStoreUrl(raw.store_url ?? raw.storeUrl),
  }
}

type Saved = { version: string; answer: UpdateAnswer }

async function readSaved(deps: UpdateDeps): Promise<UpdateAnswer | null> {
  try {
    const text = await deps.storage.get(ANSWER_KEY)
    if (!text) return null
    const saved = JSON.parse(text) as Partial<Saved>
    if (saved.version !== deps.appVersion) return null
    return parseAnswer(saved.answer)
  } catch {
    return null
  }
}

async function save(deps: UpdateDeps, answer: UpdateAnswer): Promise<void> {
  try {
    await deps.storage.set(
      ANSWER_KEY,
      JSON.stringify({ version: deps.appVersion ?? "", answer } satisfies Saved),
    )
  } catch {
    // the answer simply is not remembered
  }
}

/** What the saved answer allows while the server cannot be reached: only a standing stop survives. */
function fromSaved(saved: UpdateAnswer | null): UpdateAnswer {
  return saved && saved.status === "required" ? saved : OK
}

export async function checkForUpdate(deps: UpdateDeps): Promise<UpdateAnswer> {
  if (!deps.endpoint || !deps.platform || !deps.appVersion) return OK
  const saved = await readSaved(deps)
  try {
    const url = new URL(deps.endpoint)
    url.searchParams.set("platform", deps.platform)
    url.searchParams.set("version", deps.appVersion)
    const controller = typeof AbortController === "function" ? new AbortController() : null
    const timer = controller ? setTimeout(() => controller.abort(), deps.timeoutMs ?? 8000) : null
    let response: Response
    try {
      response = await deps.fetch(url.toString(), controller ? { signal: controller.signal } : undefined)
    } finally {
      if (timer) clearTimeout(timer)
    }
    if (!response.ok) return fromSaved(saved)
    const answer = parseAnswer(await response.json())
    if (!answer) return fromSaved(saved)
    await save(deps, answer)
    return answer
  } catch {
    return fromSaved(saved)
  }
}

/** The banner is hidden when the person dismissed THIS recommended version. */
export async function bannerDismissed(deps: UpdateDeps, answer: UpdateAnswer): Promise<boolean> {
  if (answer.status !== "recommended") return false
  try {
    return (await deps.storage.get(DISMISSED_KEY)) === (answer.recommendedVersion ?? "any")
  } catch {
    return false
  }
}

export async function dismissBanner(deps: UpdateDeps, answer: UpdateAnswer): Promise<void> {
  try {
    await deps.storage.set(DISMISSED_KEY, answer.recommendedVersion ?? "any")
  } catch {
    // shown again next launch
  }
}

/** The address of the button: the server's link, else (Android only) the store page of our package. */
export function storeTarget(answer: UpdateAnswer, platform: string | undefined, androidPackage: string) {
  if (answer.storeUrl) return answer.storeUrl
  if (platform === "android") {
    return `https://play.google.com/store/apps/details?id=${encodeURIComponent(androidPackage)}`
  }
  return null
}
