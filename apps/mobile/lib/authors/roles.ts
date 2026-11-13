import type { KindCount } from "@/lib/authors/types"
import type { RemoteRecording } from "@/lib/kirtan/remote"

/**
 * The two roles a person can have on a recording, for the two tabs of the person's page ("Wrote" / "Performs").
 *
 * The honest rule, from what the app already receives: a recording is "wrote" only when the API says so (`by_author`, the
 * uploader's own "I wrote this" tick, or later a confirmed mark). Every other recording of the page is "performs": its `author`
 * text is the performer or group. The free text `credits` ("Words and music by ...") is NEVER read to guess who wrote a song.
 * Until the server stores roles as data (a list of who wrote it, a confirmed role, a performer field), this is all that can be said.
 * Plain data, no React.
 */
export type PersonRole = "wrote" | "performs"

/** The order of the tabs. */
export const PERSON_ROLES: readonly PersonRole[] = ["wrote", "performs"]

export type RoleCounts = Record<PersonRole, number>

/** The role of one recording on the page of the person it is listed on. */
export function roleOf(recording: Pick<RemoteRecording, "by_author">): PersonRole {
  return recording.by_author === true ? "wrote" : "performs"
}

export function roleCounts(recordings: readonly Pick<RemoteRecording, "by_author">[]): RoleCounts {
  const counts: RoleCounts = { wrote: 0, performs: 0 }
  for (const r of recordings) counts[roleOf(r)] += 1
  return counts
}

/** The tabs to show: a role with no recording is hidden, and with one role left there are no tabs at all (an empty list). */
export function visibleRoles(counts: RoleCounts): PersonRole[] {
  const on = PERSON_ROLES.filter((r) => counts[r] > 0)
  return on.length < 2 ? [] : on
}

/** The tab a page opens on: the role with more recordings; a tie opens on "performs", what the page has always been. */
export function defaultRole(counts: RoleCounts): PersonRole {
  return counts.wrote > counts.performs ? "wrote" : "performs"
}

/** The tab in use: the person's pick when it is still a visible tab, the default otherwise; null when there are no tabs. */
export function activeRole(counts: RoleCounts, picked: PersonRole | null): PersonRole | null {
  const roles = visibleRoles(counts)
  if (!roles.length) return null
  return picked && roles.includes(picked) ? picked : defaultRole(counts)
}

/** Kinds with their counts, most recordings first then by name, from the recordings in hand. */
export function kindCountsOf(recordings: readonly Pick<RemoteRecording, "kind">[]): KindCount[] {
  const map = new Map<string, number>()
  for (const r of recordings) map.set(r.kind, (map.get(r.kind) ?? 0) + 1)
  return [...map].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind))
}
