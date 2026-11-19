/**
 * "Several performers on one recording" (docs/co-performers.md), the pure part: the people the uploader names on the upload
 * form, the state of a credit, the credit line under a recording, the words of an invitation. No React, no network, so the
 * unit tests (__tests__/credits.test.ts) reach all of it.
 *
 * Rules the helpers keep (the server keeps the same ones; the phone only stops the obvious mistakes early):
 *  - at most 10 people on one recording;
 *  - one person once: the same author page, or the same name (case and spacing do not make a different name);
 *  - a name with no author page stays plain text; a named page is asked first and shows the recording only after "Yes, it's me";
 *  - Baba's Audio has no performers at all.
 */
import { normalizeKind } from "@/lib/kirtan/kind"
import type { RecordingKind } from "@/lib/kirtan/types"

export type CreditRole = "performer" | "author"
export type CreditStatus = "text" | "invited" | "accepted" | "declined" | "removed" | "expired"

/** The roles in the order the form offers them: "Sings / plays" and "Wrote it". The server has two. */
export const CREDIT_ROLES: readonly CreditRole[] = ["performer", "author"]

/** The most people on one recording. One constant, the same number as the server's `MAX_CREDITS`. */
export const MAX_PERFORMERS = 10
export const NAME_MAX = 120

/** A person on the upload form. `profileId` is an author page (a member who can say yes); null means a plain name. */
export type PerformerChip = {
  /** the stable key of the row in the list (not sent) */
  key: string
  name: string
  profileId: string | null
  /** the page's address, for showing the avatar and opening the page; never sent */
  slug: string | null
  role: CreditRole
}

/** What the server takes in `performers` of the upload and in "add a person". */
export type PerformerPayload = { name: string; profile_id?: string; role: CreditRole }

/** Case and spacing do not make a different name. */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase()
}

export function tidyName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, NAME_MAX)
}

/** Why a person could not be added: the sentence key suffix (`credits.problem.<reason>`). */
export type AddProblem = "empty" | "limit" | "duplicate"

export type AddResult = { list: PerformerChip[]; problem: AddProblem | null }

let counter = 0
function nextKey(): string {
  counter += 1
  return `p${counter}`
}

/** Adds one person. A page already on the list, or a name already on it, is not added twice; the eleventh is refused. */
export function addChip(list: readonly PerformerChip[], input: { name: string; profileId?: string | null; slug?: string | null; role?: CreditRole }): AddResult {
  const name = tidyName(input.name)
  if (nameKey(name).length < 2) return { list: [...list], problem: "empty" }
  const profileId = input.profileId ?? null
  const taken = list.some((c) => (profileId !== null && c.profileId === profileId) || nameKey(c.name) === nameKey(name))
  if (taken) return { list: [...list], problem: "duplicate" }
  if (list.length >= MAX_PERFORMERS) return { list: [...list], problem: "limit" }
  const role: CreditRole = input.role === "author" ? "author" : "performer"
  return { list: [...list, { key: nextKey(), name, profileId, slug: profileId ? (input.slug ?? null) : null, role }], problem: null }
}

export function removeChip(list: readonly PerformerChip[], key: string): PerformerChip[] {
  return list.filter((c) => c.key !== key)
}

export function setChipRole(list: readonly PerformerChip[], key: string, role: CreditRole): PerformerChip[] {
  return list.map((c) => (c.key === key ? { ...c, role } : c))
}

/** A kind that can carry performers: every kind except Baba's Audio. */
export function kindHasPeople(kind: RecordingKind | string | null | undefined): boolean {
  return normalizeKind(kind) !== "baba_audio"
}

/** The `performers` of the upload: absent when there are none (or the kind has none), at most 10, a page by its id, a plain name by its name only. */
export function performersPayload(list: readonly PerformerChip[] | null | undefined, kind: RecordingKind | string | null | undefined): PerformerPayload[] | undefined {
  if (!list?.length || !kindHasPeople(kind)) return undefined
  return list.slice(0, MAX_PERFORMERS).map((c) => ({ name: c.name, ...(c.profileId ? { profile_id: c.profileId } : {}), role: c.role }))
}

/** The same list read back from a stored submission (a name and maybe a page id): a stored row has no key, so it gets one. */
export function chipsFromPayload(list: readonly PerformerPayload[] | null | undefined): PerformerChip[] {
  const out: PerformerChip[] = []
  for (const p of list ?? []) {
    const added = addChip(out, { name: p.name, profileId: p.profile_id ?? null, role: p.role })
    out.splice(0, out.length, ...added.list)
  }
  return out
}

/* ---------------------------------------------------------------- the state of a credit */

/** The colour family of a state's dot: names the screens map to theme colours. */
export type StateTone = "plain" | "waiting" | "done" | "quiet"

export type StateView = {
  /** the sentence key (`credits.state.<id>`) */
  key: `credits.state.${"text" | "invited" | "accepted" | "removed"}`
  tone: StateTone
}

/**
 * How a credit reads for the person who added it: no page is plain text; an invitation is "waiting for an answer"; a yes is
 * "confirmed". A "no" or a person who left shows as plain text (nobody is told why: docs/co-performers.md).
 */
export function stateView(status: CreditStatus): StateView {
  switch (status) {
    case "accepted":
      return { key: "credits.state.accepted", tone: "done" }
    case "invited":
      return { key: "credits.state.invited", tone: "waiting" }
    case "declined":
    case "expired":
    case "text":
      return { key: "credits.state.text", tone: "plain" }
    case "removed":
      return { key: "credits.state.removed", tone: "quiet" }
  }
}

/** The role's sentence key. */
export function roleKey(role: CreditRole): `credits.role.${CreditRole}` {
  return `credits.role.${role}`
}

/** What the public API sends for one credit. */
export type CreditView = {
  id: string
  name: string
  role: CreditRole
  status: CreditStatus
  page: { slug: string; display_name: string } | null
}

/** A credit the public sees: a plain name, or a confirmed person. A removed one is never shown. */
export function visibleCredits(list: readonly CreditView[], isManager: boolean): CreditView[] {
  return list.filter((c) => c.status !== "removed" && (isManager || c.status === "text" || c.status === "accepted"))
}

/** "2 confirmed · 1 waiting": the two numbers the uploader sees. A zero is left out; nothing at all gives an empty string. */
export function summaryParts(summary: { confirmed: number; waiting: number } | null | undefined): { confirmed: number; waiting: number } {
  return { confirmed: Math.max(0, summary?.confirmed ?? 0), waiting: Math.max(0, summary?.waiting ?? 0) }
}

/** A page of a confirmed person opens inside the app; a name with no page or a waiting credit is plain text. */
export function creditLink(credit: CreditView): string | null {
  if (credit.status !== "accepted" || !credit.page?.slug) return null
  return `/author/${encodeURIComponent(credit.page.slug)}`
}

/** One piece of the credit line: text, or a person with the address of their page. */
export type LinePart = { text: string; href: string | null }

/**
 * The credit line under a recording: the other people on it, in order. A confirmed person is a link to their page; a plain
 * or waiting name is plain text. `skip` is the name already written as the recording's own author line (so it is not said twice).
 */
export function creditLine(list: readonly CreditView[], isManager: boolean, skip?: readonly string[]): LinePart[] {
  const skipped = new Set((skip ?? []).map(nameKey))
  return visibleCredits(list, isManager)
    .filter((c) => !skipped.has(nameKey(c.name)))
    .map((c) => ({ text: c.page?.display_name && c.status === "accepted" ? c.page.display_name : c.name, href: creditLink(c) }))
}

/** True when the line has a person to show. */
export function hasCreditLine(parts: readonly LinePart[]): boolean {
  return parts.length > 0
}

/* ---------------------------------------------------------------- invitations */

/** One invitation as the server lists it (`GET /authors/me/credit-invites`). */
export type InviteView = {
  credit_id: string
  recording: { id: string; kind: string; title: string; author: string }
  from_name: string
  role: CreditRole
  created_at: string
  expires_at: string | null
}

/** The values of the sentence "{who} added you as {role} on “{title}”": the role word's key is read through `roleKey`. */
export function inviteWords(invite: InviteView): { who: string; title: string; roleKey: `credits.role.${CreditRole}` } {
  return { who: invite.from_name.trim() || invite.recording.author.trim(), title: invite.recording.title, roleKey: roleKey(invite.role) }
}

/** Whole days left before an unanswered invitation goes back to a plain name; null when it has no end. Never below zero. */
export function daysLeft(invite: Pick<InviteView, "expires_at">, now: number): number | null {
  if (!invite.expires_at) return null
  const end = Date.parse(invite.expires_at)
  if (!Number.isFinite(end)) return null
  return Math.max(0, Math.ceil((end - now) / 86_400_000))
}

/** The link the uploader gives a person who has no account yet; the token is the whole secret, so it is never logged. */
export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/credit/${encodeURIComponent(token)}`
}

/** A token read from the pasted or opened link: the last path part of `…/credit/<token>`, or the bare token. Null when it is not one. */
export function tokenFromLink(text: string | null | undefined): string | null {
  const raw = (text ?? "").trim()
  if (!raw) return null
  const found = /\/credit\/([A-Za-z0-9_-]{20,200})(?:[/?#]|$)/.exec(raw)
  const token = found ? found[1]! : raw
  return /^[A-Za-z0-9_-]{20,200}$/.test(token) ? token : null
}
