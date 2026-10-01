/** Daily “deep AI” companion questions (API-enforced in ai_quota.py). */
export const AI_COMPANION_GUEST_DAILY_DEEP_AI_LIMIT = 15
export const AI_COMPANION_MEMBER_DAILY_DEEP_AI_LIMIT = 50

export function guestDeepAiQuotaLabel() {
  return `Guest · ${AI_COMPANION_GUEST_DAILY_DEEP_AI_LIMIT} Deep AI`
}

export function memberDeepAiQuotaLabel(variant: "signed_in" | "profile" = "signed_in") {
  const prefix = variant === "profile" ? "Profile" : "Signed in"
  return `${prefix} · ${AI_COMPANION_MEMBER_DAILY_DEEP_AI_LIMIT} Deep AI`
}
