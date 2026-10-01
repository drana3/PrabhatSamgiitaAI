import { describe, expect, it } from "vitest"

import {
  AI_COMPANION_GUEST_DAILY_DEEP_AI_LIMIT,
  AI_COMPANION_MEMBER_DAILY_DEEP_AI_LIMIT,
  guestDeepAiQuotaLabel,
  memberDeepAiQuotaLabel,
} from "./ai-companion-quota"

describe("ai companion quota", () => {
  it("fixes guest at 15 and signed-in at 50 deep AI questions per day", () => {
    expect(AI_COMPANION_GUEST_DAILY_DEEP_AI_LIMIT).toBe(15)
    expect(AI_COMPANION_MEMBER_DAILY_DEEP_AI_LIMIT).toBe(50)
  })

  it("formats UI labels", () => {
    expect(guestDeepAiQuotaLabel()).toBe("Guest · 15 Deep AI")
    expect(memberDeepAiQuotaLabel("signed_in")).toBe("Signed in · 50 Deep AI")
    expect(memberDeepAiQuotaLabel("profile")).toBe("Profile · 50 Deep AI")
  })
})
