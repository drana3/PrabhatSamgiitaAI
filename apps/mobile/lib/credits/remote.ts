import { NetworkError, RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"
import type { CreditRole, CreditStatus, CreditView, InviteView, PerformerPayload } from "@/lib/kirtan/credits"

/**
 * The phone's side of "several performers on one recording" (apps/api `/api/v1/...credits...`; docs/co-performers.md).
 * Plain `fetch`, no React: the base URL, the member headers and `fetch` come in through `RemoteConfig`, so the tests use a fake
 * server. The real wiring is lib/credits/api.ts. A failed answer is a `RemoteError` whose `code` is the server's code
 * (`already_added`, `invites_off`, `too_many`, ...); a lost connection is a `NetworkError`.
 */

export type CreditList = { credits: CreditView[]; can_manage: boolean; summary: { confirmed: number; waiting: number } }
export type MyCredit = { credit_id: string; recording: { id: string; kind: string; title: string; author: string }; role: CreditRole; shown: boolean }
export type BlockedPerson = { id: string; name: string }
export type InviteLinkOut = { token: string; expires_at: string }
export type CreditOut = CreditView & { status: CreditStatus }

export interface CreditsApi {
  /** true: invented data (the preview) */
  readonly demo: boolean
  list(recordingId: string): Promise<CreditList>
  add(recordingId: string, person: PerformerPayload): Promise<CreditList>
  remove(recordingId: string, creditId: string): Promise<void>
  setRole(recordingId: string, creditId: string, role: CreditRole): Promise<CreditOut>
  link(recordingId: string, creditId: string): Promise<InviteLinkOut>
  invites(): Promise<InviteView[]>
  accept(creditId: string): Promise<CreditOut>
  /** `block`: "Not me, and do not let this person add me again" */
  decline(creditId: string, block?: boolean): Promise<CreditOut>
  mine(): Promise<MyCredit[]>
  leave(creditId: string): Promise<CreditOut>
  setMyRole(creditId: string, role: CreditRole): Promise<CreditOut>
  acceptLink(token: string): Promise<CreditOut>
  settings(): Promise<{ credit_invites: "everyone" | "nobody" }>
  setSettings(value: "everyone" | "nobody"): Promise<{ credit_invites: "everyone" | "nobody" }>
  blocks(): Promise<BlockedPerson[]>
  unblock(id: string): Promise<void>
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

async function call<T>(cfg: RemoteConfig, method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await (cfg.fetch ?? fetch)(`${cfg.baseUrl.replace(/\/+$/, "")}/api/v1${path}`, {
      method,
      headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...cfg.headers() },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : undefined)
  }
  if (!response.ok) throw await readError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

const enc = encodeURIComponent

export function createCreditsApi(cfg: RemoteConfig): CreditsApi {
  return {
    demo: false,
    list: (recordingId) => call<CreditList>(cfg, "GET", `/recordings/${enc(recordingId)}/credits`),
    add: (recordingId, person) => call<CreditList>(cfg, "POST", `/recordings/${enc(recordingId)}/credits`, person),
    remove: (recordingId, creditId) => call<void>(cfg, "DELETE", `/recordings/${enc(recordingId)}/credits/${enc(creditId)}`),
    setRole: (recordingId, creditId, role) => call<CreditOut>(cfg, "PUT", `/recordings/${enc(recordingId)}/credits/${enc(creditId)}/role`, { role }),
    link: (recordingId, creditId) => call<InviteLinkOut>(cfg, "POST", `/recordings/${enc(recordingId)}/credits/${enc(creditId)}/link`),
    invites: async () => (await call<{ items: InviteView[] }>(cfg, "GET", "/authors/me/credit-invites")).items ?? [],
    accept: (creditId) => call<CreditOut>(cfg, "POST", `/authors/me/credit-invites/${enc(creditId)}/accept`),
    decline: (creditId, block = false) => call<CreditOut>(cfg, "POST", `/authors/me/credit-invites/${enc(creditId)}/decline`, { block }),
    mine: async () => (await call<{ items: MyCredit[] }>(cfg, "GET", "/authors/me/credits")).items ?? [],
    leave: (creditId) => call<CreditOut>(cfg, "POST", `/authors/me/credits/${enc(creditId)}/leave`),
    setMyRole: (creditId, role) => call<CreditOut>(cfg, "PUT", `/authors/me/credits/${enc(creditId)}/role`, { role }),
    acceptLink: (token) => call<CreditOut>(cfg, "POST", "/credit-links/accept", { token }),
    settings: () => call(cfg, "GET", "/authors/me/credit-settings"),
    setSettings: (value) => call(cfg, "PUT", "/authors/me/credit-settings", { credit_invites: value }),
    blocks: async () => (await call<{ items: BlockedPerson[] }>(cfg, "GET", "/authors/me/credit-blocks")).items ?? [],
    unblock: (id) => call<void>(cfg, "DELETE", `/authors/me/credit-blocks/${enc(id)}`),
  }
}
