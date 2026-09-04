import {
  parseSargamInput,
  sampleSongTiming,
  westernToHz,
  type SheetPlayEvent,
  type SargamCaptureEvent,
  type SargamCaptureLine,
  type SargamCaptureMutation,
  type SargamCapturePayload,
} from "@prabhat/core"

export function eventsToSheet(events: SargamCaptureEvent[]): SheetPlayEvent[] {
  return events.map((event) => ({
    western: event.western,
    frequencyHz: westernToHz(event.western) ?? 261.63,
    startSec: event.startSec,
    durationSec: Math.max(0.12, event.durationSec),
  }))
}

export function concatenateLines(lines: SargamCaptureLine[], restSec: number): SheetPlayEvent[] {
  let offset = 0
  const all: SheetPlayEvent[] = []
  for (const [index, line] of lines.entries()) {
    const events = eventsToSheet(line.events || [])
    const end = events.reduce((max, event) => Math.max(max, event.startSec + event.durationSec), 0)
    for (const event of events) {
      all.push({ ...event, startSec: event.startSec + offset })
    }
    offset += end + (index === lines.length - 1 ? 0 : restSec)
  }
  return all
}

export function canSubmitLines(lines: SargamCaptureLine[]): boolean {
  return lines.length > 0 && lines.every((line) => line.status === "confirmed")
}

export function learnerNotationVisible(enabled: boolean | null | undefined): boolean {
  return enabled === true
}

export function normalizeCapturePayload(capture: SargamCapturePayload): SargamCapturePayload {
  return {
    ...capture,
    notation_enabled: learnerNotationVisible(capture.notation_enabled),
  }
}

function sargamToken(octave: string, token: string): string {
  if (octave === "lower") return `.${token}`
  if (octave === "upper") return `${token}'`
  return token
}

export function sargamTextToEvents(text: string, tonic: string, tempoBpm: number): SargamCaptureEvent[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const timing = sampleSongTiming(tempoBpm)
  const swaras = parseSargamInput(trimmed, tonic)
  const events: SargamCaptureEvent[] = []
  let cursor = 0
  for (const swara of swaras) {
    if (events.length) cursor += timing.gapSec
    events.push({
      sargam: sargamToken(swara.octave, swara.token),
      western: swara.western,
      startSec: cursor,
      durationSec: timing.noteSec,
    })
    cursor += timing.noteSec
  }
  return events
}

export function applySavedTake(
  capture: SargamCapturePayload,
  lineNumber: number,
  events: SargamCaptureEvent[],
): SargamCapturePayload {
  const lines = capture.lines.map((line) => {
    if (line.line_number !== lineNumber) return line
    return {
      ...line,
      status: "recorded" as const,
      events,
      sargam: events.map((event) => event.sargam).join(" "),
    }
  })
  return { ...capture, lines, can_submit: canSubmitLines(lines) }
}

export function applyLineAction(
  capture: SargamCapturePayload,
  lineNumber: number,
  action: "confirm" | "retake",
): SargamCapturePayload {
  const lines = capture.lines.map((line) => {
    if (line.line_number !== lineNumber) return line
    if (action === "confirm") {
      return { ...line, status: "confirmed" as const }
    }
    return { ...line, status: "empty" as const, events: [], sargam: null }
  })
  return {
    ...capture,
    lines,
    can_submit: canSubmitLines(lines),
  }
}

export function mergeCapture(current: SargamCapturePayload, next: SargamCapturePayload): SargamCapturePayload {
  return { ...current, ...next, lines: next.lines }
}

export function mergeMutation(
  current: SargamCapturePayload,
  patch: SargamCaptureMutation,
): SargamCapturePayload {
  const lines = patch.line
    ? current.lines.map((line) => (line.line_number === patch.line!.line_number ? patch.line! : line))
    : current.lines
  return {
    ...current,
    source_scale: patch.source_scale,
    tempo_bpm: patch.tempo_bpm,
    can_submit: patch.can_submit,
    submitted: patch.submitted,
    notation_enabled:
      patch.notation_enabled === null || patch.notation_enabled === undefined
        ? learnerNotationVisible(current.notation_enabled)
        : learnerNotationVisible(patch.notation_enabled),
    lines,
  }
}
