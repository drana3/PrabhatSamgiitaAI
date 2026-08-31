import { describe, expect, it, vi } from "vitest"

import {
  buildCaptureStudioSessionActions,
  buildCaptureStudioToolbarActions,
  captureStudioLineHeading,
  captureStudioSongLabel,
  shouldConfirmDiscardRecording,
  type CaptureStudioToolbarHandlers,
  type CaptureStudioToolbarState,
} from "@/lib/adminSargamStudio"

const handlers: CaptureStudioToolbarHandlers = {
  onPrevLine: vi.fn(),
  onNextLine: vi.fn(),
  onRecord: vi.fn(),
  onSave: vi.fn(),
  onPlayLine: vi.fn(),
  onReplay: vi.fn(),
  onReset: vi.fn(),
  onConfirm: vi.fn(),
}

function baseState(overrides: Partial<CaptureStudioToolbarState> = {}): CaptureStudioToolbarState {
  return {
    recording: false,
    playing: false,
    pendingSave: false,
    pendingConfirm: false,
    pendingRetake: false,
    notesCaptured: 0,
    bookletLocked: false,
    lineStatus: "empty",
    previewEvents: [],
    lineEvents: [],
    canPrev: false,
    canNext: true,
    ...overrides,
  }
}

describe("admin sargam fullscreen studio", () => {
  it("formats song number and line lyrics heading", () => {
    expect(captureStudioSongLabel(5, "Bandhu he niye calo")).toBe("PS 5 · Bandhu he niye calo")
    expect(captureStudioSongLabel(12)).toBe("PS 12")
    expect(captureStudioLineHeading(1)).toBe("Line 1 · Lyrics")
  })

  it("exposes Previous, Next, Record, Play, Replay, Reset, and Confirm in idle mode", () => {
    const actions = buildCaptureStudioToolbarActions(
      baseState({
        canPrev: false,
        canNext: true,
        previewEvents: [{ sargam: "S", western: "C4", startSec: 0, durationSec: 0.2 }],
      }),
      handlers,
    )
    const labels = Object.fromEntries(actions.map((action) => [action.id, action.label]))
    expect(labels.previous).toBe("Previous")
    expect(labels.next).toBe("Next")
    expect(labels.record).toBe("Record")
    expect(labels.play).toBe("Play")
    expect(labels.replay).toBe("Replay")
    expect(labels.reset).toBe("Reset")
    expect(labels.confirm).toBe("Confirm")
    expect(actions.find((action) => action.id === "save")).toBeUndefined()
  })

  it("swaps Record for Save while recording and blocks line navigation", () => {
    const actions = buildCaptureStudioToolbarActions(
      baseState({
        recording: true,
        notesCaptured: 3,
        canPrev: true,
        canNext: true,
      }),
      handlers,
    )
    const byId = Object.fromEntries(actions.map((action) => [action.id, action]))
    expect(byId.save?.label).toBe("Save")
    expect(byId.record).toBeUndefined()
    expect(byId.previous?.disabled).toBe(true)
    expect(byId.next?.disabled).toBe(true)
    expect(byId.save?.disabled).toBe(false)
  })

  it("disables Save until at least one note is captured", () => {
    const actions = buildCaptureStudioToolbarActions(
      baseState({ recording: true, notesCaptured: 0 }),
      handlers,
    )
    expect(actions.find((action) => action.id === "save")?.disabled).toBe(true)
  })

  it("wires toolbar handlers end to end", () => {
    const localHandlers = {
      onPrevLine: vi.fn(),
      onNextLine: vi.fn(),
      onRecord: vi.fn(),
      onSave: vi.fn(),
      onPlayLine: vi.fn(),
      onReplay: vi.fn(),
      onReset: vi.fn(),
      onConfirm: vi.fn(),
    }
    const actions = buildCaptureStudioToolbarActions(
      baseState({
        canPrev: true,
        canNext: true,
        previewEvents: [{ sargam: "S", western: "C4", startSec: 0, durationSec: 0.2 }],
        lineEvents: [{ sargam: "R", western: "D4", startSec: 0.2, durationSec: 0.2 }],
        lineStatus: "recorded",
      }),
      localHandlers,
    )
    const press = (id: string) => {
      const action = actions.find((item) => item.id === id)
      expect(action).toBeTruthy()
      action?.onPress()
    }
    press("previous")
    press("next")
    press("record")
    press("play")
    press("replay")
    press("reset")
    press("confirm")
    expect(localHandlers.onPrevLine).toHaveBeenCalledTimes(1)
    expect(localHandlers.onNextLine).toHaveBeenCalledTimes(1)
    expect(localHandlers.onRecord).toHaveBeenCalledTimes(1)
    expect(localHandlers.onPlayLine).toHaveBeenCalledTimes(1)
    expect(localHandlers.onReplay).toHaveBeenCalledTimes(1)
    expect(localHandlers.onReset).toHaveBeenCalledTimes(1)
    expect(localHandlers.onConfirm).toHaveBeenCalledTimes(1)
  })

  it("walks line 1 record then save flow labels", () => {
    const idle = buildCaptureStudioToolbarActions(
      baseState({ canNext: true, lineStatus: "empty" }),
      handlers,
    )
    expect(idle.find((action) => action.id === "record")?.label).toBe("Record")

    const recording = buildCaptureStudioToolbarActions(
      baseState({ recording: true, notesCaptured: 4, canPrev: false, canNext: true }),
      handlers,
    )
    expect(recording.find((action) => action.id === "save")?.label).toBe("Save")
    expect(recording.find((action) => action.id === "previous")?.disabled).toBe(true)
  })

  it("asks before discarding an active take", () => {
    expect(shouldConfirmDiscardRecording(true, 3)).toBe(true)
    expect(shouldConfirmDiscardRecording(true, 0)).toBe(false)
    expect(shouldConfirmDiscardRecording(false, 5)).toBe(false)
  })

  it("includes listen, play full, and submit session actions", () => {
    const actions = buildCaptureStudioSessionActions(
      {
        listenUrl: "https://example.com/song.mp3",
        canPlayFullSong: true,
        canSubmit: true,
        pendingSubmit: false,
      },
      {
        onPlayFullSong: vi.fn(),
        onSubmit: vi.fn(),
      },
    )
    expect(actions.map((action) => action.id)).toEqual(["listen", "play-full", "submit"])
    expect(actions.find((action) => action.id === "submit")?.label).toBe("Submit song")
  })
})
