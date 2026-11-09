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
  // Nobody is asked for a mobile number any more (decision of 9 November 2026: sign-up is name, e-mail,
  // password). The server answers false too; this keeps an older server from sending people to the form.
  void profile
  void identityProvider
  return false
}
