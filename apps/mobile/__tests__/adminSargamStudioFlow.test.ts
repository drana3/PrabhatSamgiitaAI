import { describe, expect, it } from "vitest"

import {
  applyLineAction,
  applySavedTake,
  normalizeCapturePayload,
  sargamTextToEvents,
} from "@/lib/adminSargamCapture"
import { buildCaptureStudioToolbarActions, captureStudioLineHeading } from "@/lib/adminSargamStudio"
import type { SargamCapturePayload } from "@prabhat/core"

const capture: SargamCapturePayload = {
  song_number: 5,
  title: "Test song",
  booklet_locked: false,
  source_scale: "C",
  tempo_bpm: 100,
  can_submit: false,
  submitted: false,
  notation_enabled: true,
  lines: [
    { line_number: 1, lyric: "First lyric line", status: "empty", events: [] },
    { line_number: 2, lyric: "Second lyric line", status: "empty", events: [] },
  ],
}

describe("admin sargam studio capture flow", () => {
  it("records line 1, saves, confirms, and advances toolbar state", () => {
    let payload = normalizeCapturePayload(capture)
    const events = sargamTextToEvents("Sa Re Ga", "C", 100)
    payload = applySavedTake(payload, 1, events)
    expect(payload.lines[0]?.status).toBe("recorded")

    const afterSave = buildCaptureStudioToolbarActions(
      {
        recording: false,
        playing: false,
        pendingSave: false,
        pendingConfirm: false,
        pendingRetake: false,
        notesCaptured: 0,
        bookletLocked: false,
        lineStatus: payload.lines[0]?.status,
        previewEvents: payload.lines[0]?.events ?? [],
        lineEvents: payload.lines[0]?.events ?? [],
        canPrev: false,
        canNext: true,
      },
      {
        onPrevLine: () => undefined,
        onNextLine: () => undefined,
        onRecord: () => undefined,
        onSave: () => undefined,
        onPlayLine: () => undefined,
        onReplay: () => undefined,
        onReset: () => undefined,
        onConfirm: () => undefined,
      },
    )
    expect(captureStudioLineHeading(1)).toBe("Line 1 · Lyrics")
    expect(afterSave.find((action) => action.id === "confirm")?.disabled).toBe(false)
    expect(afterSave.find((action) => action.id === "replay")?.disabled).toBe(false)

    payload = applyLineAction(payload, 1, "confirm")
    expect(payload.lines[0]?.status).toBe("confirmed")
    expect(payload.lines[1]?.status).toBe("empty")
  })
})
