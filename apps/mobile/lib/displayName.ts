/** True when a string looks like an email address rather than a person name. */
export function looksLikeEmail(value: string | null | undefined): boolean {
  const trimmed = (value || "").trim()
  return trimmed.includes("@")
}

const GENERIC_MEMBER_LABELS = new Set([
  "apple member",
  "google member",
  "facebook member",
  "microsoft member",
  "prabhat samgiita member",
  "member",
  "friend",
  "guest",
  "your account",
])

/** Placeholder names from OAuth fallbacks — not real person names. */
export function isGenericMemberLabel(value?: string | null): boolean {
  const normalized = (value || "").trim().toLowerCase()
  if (!normalized) return true
  return GENERIC_MEMBER_LABELS.has(normalized)
}

export function isApplePrivateRelayEmail(email?: string | null): boolean {
  return /@privaterelay\.appleid\.com$/i.test((email || "").trim())
}

/** Friendly label from a signed-in email (e.g. dewasheesh.rana@gmail.com → Dewasheesh Rana). */
export function displayNameFromEmail(email: string): string {
  const trimmed = email.trim()
  if (!looksLikeEmail(trimmed)) return trimmed

  const local = trimmed.split("@", 1)[0] || ""
  const words = local
    .replace(/[._+\-#]+/g, " ")
    .replace(/\d+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length) {
    return words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ")
  }
  if (local) return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase()
  return trimmed
}

/**
 * Person-facing name for greetings and profile.
 * Prefer a saved display name; otherwise derive from the signed-in email.
 */
export function friendlyPersonName(
  displayName?: string | null,
  email?: string | null,
): string {
  const name = (displayName || "").trim()
  if (name && !looksLikeEmail(name) && !isGenericMemberLabel(name)) return name

  const mail = (email || "").trim()
  if (mail && looksLikeEmail(mail)) return displayNameFromEmail(mail)

  if (name && looksLikeEmail(name)) return displayNameFromEmail(name)
  return "Friend"
}

/**
 * Best display name for UI and local storage.
 * Never returns OAuth placeholders like "Apple member".
 */
export function resolveStoredDisplayName(
  displayName?: string | null,
  email?: string | null,
): string {
  const raw = (displayName || "").trim()
  const candidate =
    !raw || isGenericMemberLabel(raw) || raw.toLowerCase() === "friend" ? null : raw
  const resolved = friendlyPersonName(candidate, email)
  if (resolved !== "Friend") return resolved

  const mail = (email || "").trim()
  if (mail) return mail
  return ""
}

/** Profile / greeting name — signed-in email first, then saved name. */
export function memberProfileName(input: {
  mode: "guest" | "signed_in"
  email?: string | null
  displayName?: string | null
  displayNameOverridden?: boolean
  serverEmail?: string | null
  serverDisplayName?: string | null
}): string {
  if (input.mode === "guest") return "Guest"

  const mail = (input.serverEmail || input.email || "").trim()
  if (
    mail.includes("@") &&
    (!input.displayNameOverridden ||
      !input.displayName?.trim() ||
      isGenericMemberLabel(input.displayName))
  ) {
    return displayNameFromEmail(mail)
  }

  if (input.displayNameOverridden && input.displayName?.trim()) {
    const custom = input.displayName.trim()
    if (!isGenericMemberLabel(custom)) return custom
  }

  for (const candidate of [input.displayName, input.serverDisplayName]) {
    const name = (candidate || "").trim()
    if (name && !isGenericMemberLabel(name) && !looksLikeEmail(name)) return name
  }

  if (mail.includes("@")) return displayNameFromEmail(mail)
  return ""
}

/** Profile title — saved name, or a friendly label from the signed-in email. */
export function profileDisplayLabel(
  displayName?: string | null,
  email?: string | null,
  mode: "guest" | "signed_in" = "signed_in",
): string {
  const name = memberProfileName({
    mode,
    email,
    displayName,
    displayNameOverridden: false,
  })
  return name || (mode === "guest" ? "Guest" : "Tap to add your name")
}

export function profileAvatarInitial(
  displayName?: string | null,
  email?: string | null,
  mode: "guest" | "signed_in" = "signed_in",
): string {
  const label = profileDisplayLabel(displayName, email, mode)
  if (label === "Guest" || label === "Tap to add your name") return mode === "guest" ? "G" : "M"
  return label.charAt(0).toUpperCase()
}

/** First name for greetings — from saved name or signed-in email. */
export function greetFirstName(
  displayName?: string | null,
  email?: string | null,
): string {
  const label = profileDisplayLabel(displayName, email, "signed_in")
  if (!label || label === "Tap to add your name") return ""
  const first = label.split(/\s+/)[0]?.trim()
  return first || ""
}
