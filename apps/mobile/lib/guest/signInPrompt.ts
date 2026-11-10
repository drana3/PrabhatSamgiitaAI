import { t, type MessageKey } from "@/lib/i18n"

/**
 * When the app asks a guest to sign in, as plain rules (no React), so they are unit tested.
 *
 * Dada's decision (9-10 Nov 2026): a guest may save songs (they stay on the phone) and is asked to
 * sign in at three moments, never more than once a week for each kind of moment:
 *   saves    the 3rd saved song (or any later save, once the week is over)
 *   upload   the guest taps Upload
 *   comment  the guest taps the comment box
 * Uploading and commenting still need an account; the sheet only offers it. See docs/guest-saves.md.
 */

export type GuestPromptKind = "saves" | "upload" | "comment"

export const GUEST_PROMPT_KINDS: readonly GuestPromptKind[] = ["saves", "upload", "comment"]

/** "Not more than once a week", per kind. */
export const GUEST_PROMPT_WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** The save that asks: the third. */
export const SAVES_BEFORE_PROMPT = 3

/** A moment that is not asked for lasts this long when it has to wait for the music to stop. */
export const SAVES_PROMPT_WAIT_MS = 90_000

/** When each kind was last shown (epoch ms). A kind that was never shown is absent. */
export type GuestPromptLog = Partial<Record<GuestPromptKind, number>>

/** True when this kind was not shown in the last week. A clock that went back counts as "shown": we stay quiet. */
export function promptAllowed(log: GuestPromptLog, kind: GuestPromptKind, now: number): boolean {
  const last = log[kind]
  if (typeof last !== "number" || !Number.isFinite(last)) return true
  if (last > now) return false
  return now - last >= GUEST_PROMPT_WEEK_MS
}

/** After a guest saved something: does the number of saved items (songs and Kiirtans) call for the sheet? */
export function savesCallForPrompt(savedCount: number): boolean {
  return savedCount >= SAVES_BEFORE_PROMPT
}

/** Reads a stored log defensively: only known kinds with finite numbers survive. */
export function cleanPromptLog(raw: unknown): GuestPromptLog {
  if (!raw || typeof raw !== "object") return {}
  const out: GuestPromptLog = {}
  for (const kind of GUEST_PROMPT_KINDS) {
    const value = (raw as Record<string, unknown>)[kind]
    if (typeof value === "number" && Number.isFinite(value)) out[kind] = value
  }
  return out
}

/** The two title lines and the body of the sheet, as translation keys (typed, so a missing key fails the build). */
export const PROMPT_KEYS = {
  saves: { first: "guest.saves.title1", second: "guest.saves.title2", body: "guest.saves.body" },
  upload: { first: "guest.upload.title1", second: "guest.upload.title2", body: "guest.upload.body" },
  comment: { first: "guest.comment.title1", second: "guest.comment.title2", body: "guest.comment.body" },
} as const satisfies Record<GuestPromptKind, { first: MessageKey; second: MessageKey; body: MessageKey }>

/** What the sheet says for a kind, in the language in use: two title lines and the body. */
export function promptCopy(kind: GuestPromptKind): { first: string; second: string; body: string } {
  const keys = PROMPT_KEYS[kind]
  return { first: t(keys.first), second: t(keys.second), body: t(keys.body) }
}
