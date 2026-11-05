import { isTypeOfKind, normalizeKind } from "@/lib/kirtan/kind"
import type { Kirtan, KirtanStatus } from "@/lib/kirtan/types"

/**
 * Migration of the stored Kiirtan state (`prabhat-kirtan`).
 * v1 -> v2: every submission gets `kind`; a stored item without one is a Kiirtan. A type that does not
 * belong to the kind (a damaged value) becomes "other". Saved and reported ids are kept as they are.
 * v2 -> v3: publish-first. The statuses `pending | approved | rejected` are gone:
 *   approved -> published, pending -> failed (it never reached the server; the person can try again),
 *   rejected -> removed (the phone has no reason for it; the server's list fills it in).
 *   `blockedAuthorIds` and `blockedNames` start empty.
 * Pure: the store passes in whatever AsyncStorage held.
 */
export const KIRTAN_STORE_VERSION = 3

type Persisted = { submissions?: unknown; savedIds?: unknown; reportedIds?: unknown; blockedAuthorIds?: unknown; blockedNames?: unknown }

export type KirtanPersisted = {
  submissions: Kirtan[]
  savedIds: string[]
  reportedIds: string[]
  blockedAuthorIds: string[]
  /** what the person saw when they blocked (author key -> name), so the list of blocked authors can show a name */
  blockedNames: Record<string, string>
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

function names(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {}
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"))
}

const STATUSES: readonly KirtanStatus[] = ["uploading", "published", "failed", "removed"]

/** An old or damaged status as one of the four current ones. */
export function normalizeStatus(value: unknown): KirtanStatus {
  if (value === "approved") return "published"
  if (value === "pending") return "failed"
  if (value === "rejected") return "removed"
  return STATUSES.find((s) => s === value) ?? "failed"
}

export function migrateKirtanState(persisted: unknown, _fromVersion: number): KirtanPersisted {
  const state = (persisted && typeof persisted === "object" ? persisted : {}) as Persisted
  const submissions = Array.isArray(state.submissions) ? state.submissions : []
  return {
    submissions: submissions
      .filter((s): s is Kirtan => Boolean(s) && typeof s === "object")
      .map((s) => {
        const kind = normalizeKind((s as { kind?: unknown }).kind)
        const old = (s as { status?: unknown }).status
        const next: Kirtan = { ...s, kind, type: isTypeOfKind(kind, s.type) ? s.type : "other", status: normalizeStatus(old) }
        // a pending upload that never left the phone: it is not live, and the person can send it again
        if (old === "pending" && !next.failure) next.failure = { code: "server" }
        return next
      }),
    savedIds: strings(state.savedIds),
    reportedIds: strings(state.reportedIds),
    blockedAuthorIds: strings(state.blockedAuthorIds),
    blockedNames: names(state.blockedNames),
  }
}
