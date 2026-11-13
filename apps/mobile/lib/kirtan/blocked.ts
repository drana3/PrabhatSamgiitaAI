import { withoutBlocked } from "@/lib/kirtan/list"
import type { Kirtan } from "@/lib/kirtan/types"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * Is this recording's author one the person blocked? Same rule as the library (`withoutBlocked`: the uploader's account
 * id, or the name key on the preview). For the paths that reach a recording without going through `allKirtans()` /
 * `mergeCatalog` (the server's own record in a Top Played row, a sample shelf, a history entry), so a blocked author's
 * recording never shows or plays from there either. Unblocking takes effect at once: the store is read on every call.
 */
export function isAuthorBlocked(who: Pick<Kirtan, "authorId" | "author">, blockedAuthorIds: readonly string[] = useKirtanStore.getState().blockedAuthorIds): boolean {
  return withoutBlocked([who], blockedAuthorIds).length === 0
}
