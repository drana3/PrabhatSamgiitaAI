import { describe, expect, it } from "vitest"

import { shouldAskInContext } from "@/lib/notifications/permission"

/** The OS permission is asked when the first song or word is saved, not at launch and not only in settings (checkup U1). */
describe("asking for notification permission in context", () => {
  const base = { previous: 0, total: 1, permission: "undetermined" as const, master: true }

  it("asks when something was saved and the OS was never asked", () => {
    expect(shouldAskInContext(base)).toBe(true)
  })
  it("does not ask on the first reading, at launch", () => {
    expect(shouldAskInContext({ ...base, previous: null })).toBe(false)
  })
  it("does not ask when nothing new was saved", () => {
    expect(shouldAskInContext({ ...base, previous: 3, total: 3 })).toBe(false)
    expect(shouldAskInContext({ ...base, previous: 3, total: 2 })).toBe(false)
  })
  it("does not ask again after an answer, or before the answer is known", () => {
    expect(shouldAskInContext({ ...base, permission: "granted" })).toBe(false)
    expect(shouldAskInContext({ ...base, permission: "denied" })).toBe(false)
    expect(shouldAskInContext({ ...base, permission: "unknown" })).toBe(false)
  })
  it("does not ask when the person turned reminders off", () => {
    expect(shouldAskInContext({ ...base, master: false })).toBe(false)
  })
})
