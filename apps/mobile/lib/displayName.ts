/** True when a string looks like an email address rather than a person name. */
export function looksLikeEmail(value: string | null | undefined): boolean {
  const trimmed = (value || "").trim()
  return trimmed.includes("@")
}

/**
 * Person-facing name for greetings and profile.
 * Prefer a real display name; if we only have an email, title-case the local part
 * (e.g. dewasheesh.rana@gmail.com → "Dewasheesh Rana").
 */
export function friendlyPersonName(
  displayName?: string | null,
  email?: string | null,
): string {
  const name = (displayName || "").trim()
  if (name && !looksLikeEmail(name)) return name

  const source = looksLikeEmail(name) ? name : (email || "").trim()
  if (!looksLikeEmail(source)) return name || "Friend"

  const local = source.split("@", 1)[0] || ""
  const words = local
    .replace(/[._+\-#]+/g, " ")
    .replace(/\d+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return "Friend"
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

/** First name only for warm greetings (e.g. "Namaskar Dewasheesh"). */
export function greetFirstName(
  displayName?: string | null,
  email?: string | null,
): string {
  const full = friendlyPersonName(displayName, email)
  const first = full.split(/\s+/)[0]?.trim()
  return first || "Friend"
}
