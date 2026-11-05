import { isTypeOfKind, normalizeKind } from "@/lib/kirtan/kind"
import type { Kirtan } from "@/lib/kirtan/types"

/**
 * Migration of the stored Kiirtan state (`prabhat-kirtan`).
 * v1 -> v2: every submission gets `kind`; a stored item without one is a Kiirtan. A type that does not
 * belong to the kind (a damaged value) becomes "other". Saved and reported ids are kept as they are.
 * Pure: the store passes in whatever AsyncStorage held.
 */
export const KIRTAN_STORE_VERSION = 2

type Persisted = { submissions?: unknown; savedIds?: unknown; reportedIds?: unknown }

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

export function migrateKirtanState(persisted: unknown, _fromVersion: number): { submissions: Kirtan[]; savedIds: string[]; reportedIds: string[] } {
  const state = (persisted && typeof persisted === "object" ? persisted : {}) as Persisted
  const submissions = Array.isArray(state.submissions) ? state.submissions : []
  return {
    submissions: submissions
      .filter((s): s is Kirtan => Boolean(s) && typeof s === "object")
      .map((s) => {
        const kind = normalizeKind((s as { kind?: unknown }).kind)
        return { ...s, kind, type: isTypeOfKind(kind, s.type) ? s.type : "other" }
      }),
    savedIds: strings(state.savedIds),
    reportedIds: strings(state.reportedIds),
  }
}
