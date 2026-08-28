import { describe, expect, it } from "vitest"

import {
  applyLineAction,
  applySavedTake,
  canSubmitLines,
  sargamTextToEvents,
} from "@/lib/adminSargamCapture"
import type { SargamCapturePayload } from "@prabhat/core"

const baseCapture: SargamCapturePayload = {
  song_number: 5,
  title: "Test",
  booklet_locked: false,
  source_scale: "C",
  tempo_bpm: 100,
  can_submit: false,
  submitted: false,
  notation_enabled: true,
  lines: [
    { line_number: 1, lyric: "One", status: "empty", events: [] },
    { line_number: 2, lyric: "Two", status: "empty", events: [] },
  ],
}

describe("adminSargamCapture helpers", () => {
  it("parses pasted sargam into timed events", () => {
    const events = sargamTextToEvents("Sa Re Ga", "C", 100)
    expect(events).toHaveLength(3)
    expect(events[0]?.sargam).toBe("S")
    expect(events[1]?.startSec).toBeGreaterThan(events[0]?.startSec ?? 0)
  })

  it("marks a saved take as recorded", () => {
    const events = sargamTextToEvents("Sa Re", "C", 100)
    const next = applySavedTake(baseCapture, 1, events)
    expect(next.lines[0]?.status).toBe("recorded")
    expect(next.lines[0]?.sargam).toContain("S")
  })

  it("knows when every line is confirmed", () => {
    const confirmed = applyLineAction(
      applySavedTake(baseCapture, 1, sargamTextToEvents("Sa", "C", 100)),
      1,
      "confirm",
    )
    expect(canSubmitLines(confirmed.lines)).toBe(false)
    const saved2 = applySavedTake(confirmed, 2, sargamTextToEvents("Re", "C", 100))
    const allConfirmed = applyLineAction(saved2, 2, "confirm")
    expect(canSubmitLines(allConfirmed.lines)).toBe(true)
  })
})
