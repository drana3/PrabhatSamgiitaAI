/**
 * Pure logic of the Send feedback page: the four kinds, validation, the email check, the song
 * parameter, the device line and the payload the existing feedback endpoint takes.
 * No React Native or network imports, so every rule is unit tested.
 */

export type FeedbackKind = "broken" | "idea" | "song" | "other"

export type FeedbackKindOption = { id: FeedbackKind; label: string }

/** The four choices, in the order of the segmented control. */
export const FEEDBACK_KINDS: readonly FeedbackKindOption[] = [
  { id: "broken", label: "Something is broken" },
  { id: "idea", label: "An idea" },
  { id: "song", label: "A mistake in a song or lyrics" },
  { id: "other", label: "Something else" },
]

export const MIN_MESSAGE = 10
/** The API keeps 2000 characters of comment; the rest is for the kind, song and app lines we add. */
export const MAX_MESSAGE = 1500
export const MAX_EMAIL = 320

export function kindLabel(kind: FeedbackKind): string {
  return FEEDBACK_KINDS.find((option) => option.id === kind)?.label ?? "Something else"
}

/* Message ---------------------------------------------------------------- */

export function trimmedLength(message: string): number {
  return message.trim().length
}

export function messageReady(message: string): boolean {
  return trimmedLength(message) >= MIN_MESSAGE
}

/** `0 / 1500` */
export function counterText(message: string): string {
  return `${Math.min(message.length, MAX_MESSAGE)} / ${MAX_MESSAGE}`
}

/** The line under the box while the message is too short, or null when it is long enough. */
export function messageHelper(message: string): string | null {
  const have = trimmedLength(message)
  if (have >= MIN_MESSAGE) return null
  if (have === 0) return `Write at least ${MIN_MESSAGE} characters so we can understand it.`
  const left = MIN_MESSAGE - have
  return `${left} more ${left === 1 ? "character" : "characters"} to go.`
}

/** Cut a pasted message at the limit. */
export function clampMessage(message: string): string {
  return message.length > MAX_MESSAGE ? message.slice(0, MAX_MESSAGE) : message
}

/* Email ----------------------------------------------------------------- */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Empty is fine (the field is optional); anything typed has to look like an address. */
export function emailProblem(email: string): string | null {
  const text = email.trim()
  if (!text) return null
  if (text.length > MAX_EMAIL || !EMAIL.test(text)) return "That does not look like an email address."
  return null
}

/* Song ------------------------------------------------------------------ */

/** `?song=12`, `ps-12`, `PS 12` -> 12; anything else -> null. */
export function parseSongParam(value: string | string[] | undefined | null): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== "string") return null
  const match = /^\s*(?:ps[\s-]*)?(\d{1,5})\s*$/i.exec(raw)
  if (!match) return null
  const number = Number(match[1])
  return number >= 1 ? number : null
}

export type PickedSong = { number: number; title: string }

/** `PS 12 · Bandhu He Niye Calo` */
export function songLabel(song: PickedSong): string {
  return song.title ? `PS ${song.number} · ${song.title}` : `PS ${song.number}`
}

/** Does the typed text look like the start of a catalogue number (`12`, `ps 12`)? */
export function looksLikeNumber(query: string): boolean {
  return parseSongParam(query) != null
}

/* Device line ------------------------------------------------------------- */

export type AppDetails = {
  appVersion?: string | null
  os?: string | null
  osVersion?: string | number | null
  device?: string | null
}

/** One line, no personal data: `App 1.4.0 · iOS 19.1 · iPhone 17`. Empty when nothing is known. */
export function formatAppDetails(details: AppDetails): string {
  const parts: string[] = []
  if (details.appVersion) parts.push(`App ${details.appVersion}`)
  const system = [osName(details.os), details.osVersion != null ? String(details.osVersion) : ""].filter(Boolean).join(" ")
  if (system) parts.push(system)
  if (details.device) parts.push(details.device)
  return parts.join(" · ")
}

function osName(os: string | null | undefined): string {
  if (!os) return ""
  if (os === "ios") return "iOS"
  if (os === "android") return "Android"
  if (os === "web") return "Web"
  return os
}

/** What the switch explains, in one line. */
export const APP_DETAILS_NOTE = "Sends the app version and the system version. Nothing else."

/* Payload --------------------------------------------------------------- */

/** The categories the endpoint knows. */
export type ApiCategory = "experience" | "content" | "other"

export function apiCategoryFor(kind: FeedbackKind): ApiCategory {
  if (kind === "song") return "content"
  if (kind === "other") return "other"
  return "experience"
}

/**
 * The endpoint requires a 1 to 5 rating and this page asks for none. A broken thing is sent as 2 so it is
 * triaged first, everything else as 3. TODO(api): add a `kind` field and make rating optional.
 */
export function apiRatingFor(kind: FeedbackKind): number {
  return kind === "broken" ? 2 : 3
}

export type FeedbackForm = {
  kind: FeedbackKind
  message: string
  song: PickedSong | null
  email: string
  /** a signed-in member: replies go to the account email */
  accountEmail: string | null
  includeAppDetails: boolean
  appDetails: AppDetails
}

export type FeedbackRequest = {
  category: ApiCategory
  rating: number
  comment: string
  page_path: string
  contact?: string
}

/** The comment with the kind, song and app lines under the person's own words. */
export function buildComment(form: FeedbackForm): string {
  const lines = [form.message.trim(), "", `Kind: ${kindLabel(form.kind)}`]
  if (form.kind === "song" && form.song) lines.push(`Song: ${songLabel(form.song)}`)
  if (form.includeAppDetails) {
    const app = formatAppDetails(form.appDetails)
    if (app) lines.push(`App details: ${app}`)
  }
  return lines.join("\n")
}

/** Where the person was: the song page for a song mistake, else the feedback page. */
export function buildPagePath(form: FeedbackForm): string {
  return form.kind === "song" && form.song ? `/songs/${form.song.number}` : "/mobile/feedback"
}

/** Null when the form cannot be sent yet. */
export function buildRequest(form: FeedbackForm): FeedbackRequest | null {
  if (!messageReady(form.message)) return null
  const typed = form.email.trim()
  if (!form.accountEmail && emailProblem(typed)) return null
  const contact = (form.accountEmail ?? typed) || undefined
  return {
    category: apiCategoryFor(form.kind),
    rating: apiRatingFor(form.kind),
    comment: buildComment(form),
    page_path: buildPagePath(form),
    ...(contact ? { contact } : {}),
  }
}

/** Can the Send button be pressed? */
export function canSend(form: Pick<FeedbackForm, "message" | "email" | "accountEmail">): boolean {
  return messageReady(form.message) && (form.accountEmail != null || emailProblem(form.email) == null)
}

/* Errors ---------------------------------------------------------------- */

/** A message a person can read: network failures say so, server details pass through, the rest is generic. */
export function friendlyError(error: unknown): string {
  const text = error instanceof Error ? error.message : ""
  if (!text || /network|fetch|timed? ?out|failed to load|offline/i.test(text)) {
    return "No connection. Check the internet and try again."
  }
  return text
}
