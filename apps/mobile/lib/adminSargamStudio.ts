import type { SargamCaptureEvent, SargamCaptureLine } from "@prabhat/core"

import type { CaptureToolbarAction } from "@/components/admin/CaptureStudioToolbar"

export type CaptureStudioToolbarState = {
  recording: boolean
  playing: boolean
  pendingSave: boolean
  pendingConfirm: boolean
  pendingRetake: boolean
  notesCaptured: number
  bookletLocked: boolean
  lineStatus: SargamCaptureLine["status"] | undefined
  previewEvents: SargamCaptureEvent[]
  lineEvents: SargamCaptureEvent[]
  canPrev: boolean
  canNext: boolean
}

export type CaptureStudioToolbarHandlers = {
  onPrevLine: () => void
  onNextLine: () => void
  onRecord: () => void
  onSave: () => void
  onPlayLine: () => void
  onReplay: () => void
  onReset: () => void
  onConfirm: () => void
  onListen?: () => void
  onPlayFullSong?: () => void
  onSubmit?: () => void
}

export type CaptureStudioSessionState = {
  listenUrl?: string | null
  listenPlaying?: boolean
  listenLoading?: boolean
  canPlayFullSong?: boolean
  canSubmit?: boolean
  pendingSubmit?: boolean
}

export function captureStudioSongLabel(songNumber: number, title?: string): string {
  return title?.trim() ? `PS ${songNumber} · ${title.trim()}` : `PS ${songNumber}`
}

export function captureStudioLineHeading(lineNumber: number): string {
  return `Line ${lineNumber} · Lyrics`
}

export function buildCaptureStudioToolbarActions(
  state: CaptureStudioToolbarState,
  handlers: CaptureStudioToolbarHandlers,
): CaptureToolbarAction[] {
  const lineLocked = state.lineStatus === "confirmed"
  const actions: CaptureToolbarAction[] = [
    {
      id: "previous",
      label: "Previous",
      onPress: handlers.onPrevLine,
      disabled: !state.canPrev || state.recording,
    },
    {
      id: "next",
      label: "Next",
      onPress: handlers.onNextLine,
      disabled: !state.canNext || state.recording,
    },
    state.recording
      ? {
          id: "save",
          label: state.pendingSave ? "Saving…" : "Save",
          onPress: handlers.onSave,
          disabled: state.notesCaptured === 0 || state.pendingSave,
          primary: true,
          danger: true,
        }
      : {
          id: "record",
          label: "Record",
          onPress: handlers.onRecord,
          disabled: state.bookletLocked || lineLocked,
          primary: true,
        },
    {
      id: "play",
      label: state.playing ? "Playing…" : "Play",
      onPress: handlers.onPlayLine,
      disabled: state.previewEvents.length === 0 || state.playing,
    },
    {
      id: "replay",
      label: "Replay",
      onPress: handlers.onReplay,
      disabled: state.lineEvents.length === 0 || state.playing,
    },
    {
      id: "reset",
      label: state.pendingRetake ? "Resetting…" : "Reset",
      onPress: handlers.onReset,
      disabled: state.pendingRetake || state.lineStatus === "empty",
    },
    {
      id: "confirm",
      label: state.pendingConfirm ? "Confirming…" : "Confirm",
      onPress: handlers.onConfirm,
      disabled: state.pendingConfirm || state.lineStatus !== "recorded",
    },
  ]
  return actions
}

export const CAPTURE_STUDIO_TOOLBAR_IDS = [
  "previous",
  "next",
  "record",
  "save",
  "play",
  "replay",
  "reset",
  "confirm",
] as const

export const CAPTURE_STUDIO_SESSION_IDS = ["listen", "play-full", "submit"] as const

export function buildCaptureStudioSessionActions(
  state: CaptureStudioSessionState,
  handlers: Pick<CaptureStudioToolbarHandlers, "onListen" | "onPlayFullSong" | "onSubmit">,
): CaptureToolbarAction[] {
  const actions: CaptureToolbarAction[] = []
  if (state.listenUrl) {
    actions.push({
      id: "listen",
      label: state.listenLoading ? "Loading…" : state.listenPlaying ? "Pause song" : "Listen",
      onPress: handlers.onListen ?? (() => undefined),
      disabled: state.listenLoading || !handlers.onListen,
    })
  }
  actions.push({
    id: "play-full",
    label: "Play full song",
    onPress: handlers.onPlayFullSong ?? (() => undefined),
    disabled: !state.canPlayFullSong || !handlers.onPlayFullSong,
  })
  actions.push({
    id: "submit",
    label: state.pendingSubmit ? "Submitting…" : "Submit song",
    onPress: handlers.onSubmit ?? (() => undefined),
    disabled: !state.canSubmit || state.pendingSubmit || !handlers.onSubmit,
    primary: true,
  })
  return actions
}

export function shouldConfirmDiscardRecording(recording: boolean, notesCaptured: number): boolean {
  return recording && notesCaptured > 0
}
