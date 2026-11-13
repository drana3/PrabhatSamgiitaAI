import { describe, expect, it } from "vitest"

import { amDark, amLight } from "@/constants/tokens/amColors"
import { controlBorder, switchTrackOff } from "@/lib/controlColors"
import { amSheetScrim } from "@/constants/tokens/amColors"

describe("controlColors", () => {
  it("keeps the light outlines and tracks as they were", () => {
    expect(controlBorder({ ...amLight, dark: false })).toBe(amLight.line)
    expect(switchTrackOff({ ...amLight, dark: false })).toBe(amLight.line)
  })

  it("uses the strong outline and the off track in dark", () => {
    expect(controlBorder({ ...amDark, dark: true })).toBe(amDark.lineStrong)
    expect(switchTrackOff({ ...amDark, dark: true })).toBe(amDark.trackOff)
  })

  it("dims behind a sheet with black, darker in dark", () => {
    expect(amSheetScrim.color).toBe("#000000")
    expect(amSheetScrim.dark).toBeGreaterThan(amSheetScrim.light)
  })
})
