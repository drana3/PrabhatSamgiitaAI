import type { MemberProfile } from "@prabhat/core"

/** Mirrors API `OAUTH_IDENTITY_PROVIDERS` — OAuth sign-in does not require a mobile number. */
export const OAUTH_IDENTITY_PROVIDERS = new Set([
  "google",
  "aad",
  "facebook",
  "entra",
  "apple",
])

export function memberPhoneRequired(
  profile: Pick<MemberProfile, "phone_required" | "phone_e164" | "identity_provider">,
  identityProvider?: string | null,
): boolean {
  if (profile.phone_e164) return false
  const provider = identityProvider || profile.identity_provider || ""
  if (OAUTH_IDENTITY_PROVIDERS.has(provider)) return false
  return Boolean(profile.phone_required)
}
