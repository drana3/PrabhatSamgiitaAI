import { describe, expect, it } from "vitest"

import { sampleDayStart } from "@/lib/todayDay"

describe("sample Today day", () => {
  it("never opens in a real build, even with ?day= in the link", () => {
    expect(sampleDayStart(false, undefined)).toBeNull()
    expect(sampleDayStart(false, "fest")).toBeNull()
    expect(sampleDayStart(false, "season")).toBeNull()
  })

  it("opens the requested day in the demo preview, the plain date by default", () => {
    expect(sampleDayStart(true, "fest")).toBe("fest")
    expect(sampleDayStart(true, "season")).toBe("season")
    expect(sampleDayStart(true, undefined)).toBe("date")
    expect(sampleDayStart(true, "nonsense")).toBe("date")
  })
})
