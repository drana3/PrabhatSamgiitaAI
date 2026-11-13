import { kindHasPerformer, normalizeKind } from "@/lib/kirtan/kind"
import { kindHasByAuthor } from "@/lib/kirtan/recordingInfo"
import type { RecordingKind } from "@/lib/kirtan/types"

/**
 * "Who are you for this recording?" on the Add Recording form (Dada, 13 Nov 2026): a REQUIRED one-of-four answer for every kind,
 * with a comment under it. Pure, so it is unit tested (__tests__/uploadRole.test.ts).
 *
 *  - `wrote`    I wrote it (words or melody)      -> the API's `by_author: true`
 *  - `performs` I perform or play on it           -> `by_author: false`; the person's own name goes in an empty performer line
 *  - `both`     both of the above                 -> `by_author: true`
 *  - `sharing`  I am only sharing someone else's recording -> `by_author: false`
 * The answer itself is not a server field: the server stores `by_author` and the free text `credits` (300 characters, the comment).
 * So "performs" and "sharing" are told apart only by the comment, and "both" lands under "Wrote" on the person page.
 * A kind that cannot carry an answer does not offer it: `wrote` and `both` need the author tick (not Prabhat Samgiita, Baba's Audio or
 * Others), `performs` and `both` need a performer (not Baba's Audio). Baba's Audio has one honest answer, `sharing`, set for the person.
 */
export type UploadRole = "wrote" | "performs" | "both" | "sharing"

/** The order the four are shown in. */
export const UPLOAD_ROLES: readonly UploadRole[] = ["wrote", "performs", "both", "sharing"]

/** The comment is the existing `credits` field: 300 characters at most. */
export const ROLE_COMMENT_MAX = 300

/** The answers this kind can honestly offer, in display order. Never empty ("sharing" fits everywhere). */
export function roleChoices(kind: RecordingKind | string | null | undefined): UploadRole[] {
  const k = normalizeKind(kind)
  const canWrite = kindHasByAuthor(k) && kindHasPerformer(k)
  const canPerform = kindHasPerformer(k)
  return UPLOAD_ROLES.filter((role) => {
    if (role === "wrote") return canWrite
    if (role === "performs") return canPerform
    if (role === "both") return canWrite && canPerform
    return true
  })
}

/** The answer the form decides for the person when the kind leaves only one (Baba's Audio: "sharing"), else null. */
export function roleAuto(kind: RecordingKind | string | null | undefined): UploadRole | null {
  const choices = roleChoices(kind)
  return choices.length === 1 ? choices[0]! : null
}

/** The answer in force: the person's pick when this kind offers it, else the one the kind decides, else null (not answered yet). */
export function effectiveRole(kind: RecordingKind | string | null | undefined, role: UploadRole | null | undefined): UploadRole | null {
  if (role && roleChoices(kind).includes(role)) return role
  return roleAuto(kind)
}

/** Nothing is sent while the person has not answered. */
export function roleMissing(kind: RecordingKind | string | null | undefined, role: UploadRole | null | undefined): boolean {
  return effectiveRole(kind, role) === null
}

export const roleWrites = (role: UploadRole | null | undefined): boolean => role === "wrote" || role === "both"
export const rolePerforms = (role: UploadRole | null | undefined): boolean => role === "performs" || role === "both"

/**
 * The patch the form applies when the person picks an answer: `by_author` follows it, the "I perform" flag follows it, and a pick that
 * performs puts the person's own name in an empty performer line (never over a name already typed; a guest has none).
 */
export function rolePatch(
  draft: { performer: string },
  role: UploadRole,
  ownName: string | null | undefined,
): { role: UploadRole; byAuthor: boolean; performs: boolean; performer?: string } {
  const patch = { role, byAuthor: roleWrites(role), performs: rolePerforms(role) }
  const name = (ownName ?? "").trim()
  if (rolePerforms(role) && !draft.performer.trim() && name && name !== "Guest") return { ...patch, performer: name }
  return patch
}

/** The flags that go with the answer when the kind changes under it (an answer the new kind does not offer is dropped). */
export function roleAfterKind(kind: RecordingKind | string | null | undefined, role: UploadRole | null | undefined): { role: UploadRole | null; byAuthor: boolean; performs: boolean } {
  const next = effectiveRole(kind, role)
  return { role: next, byAuthor: kindHasByAuthor(kind as string) && roleWrites(next), performs: kindHasPerformer(normalizeKind(kind)) && rolePerforms(next) }
}
