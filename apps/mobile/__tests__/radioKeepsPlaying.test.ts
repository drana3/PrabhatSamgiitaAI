import { describe, expect, it } from "vitest"

import { RADIO_KEEPS_PLAYING_ON_LEAVE, driveBlurDecision, isRadioRunning } from "@/lib/radio/keepPlaying"

describe("the Radio keeps playing when its screen is left", () => {
  it("the flag is on (Dada's decision)", () => {
    expect(RADIO_KEEPS_PLAYING_ON_LEAVE).toBe(true)
  })

  it("a running Radio is random mode with drive advance on", () => {
    expect(isRadioRunning({ playbackMode: "random", driveAutoAdvance: true })).toBe(true)
    expect(isRadioRunning({ playbackMode: "random", driveAutoAdvance: false })).toBe(false)
    expect(isRadioRunning({ playbackMode: "playlist", driveAutoAdvance: true })).toBe(false)
  })

  it("keeps the Radio, ends a drive playlist, and never stops a song that replaced the Radio", () => {
    expect(driveBlurDecision({ playbackMode: "random", driveAutoAdvance: true })).toBe("keep")
    expect(driveBlurDecision({ playbackMode: "playlist", driveAutoAdvance: true })).toBe("exit")
    expect(driveBlurDecision({ playbackMode: "default", driveAutoAdvance: true })).toBe("forget")
    expect(driveBlurDecision({ playbackMode: "default", driveAutoAdvance: false })).toBe("exit")
  })
})
