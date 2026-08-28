"use client"

import { memo, useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { AdminShell } from "@/components/admin-shell"
import { VirtualHarmonium } from "@/components/virtual-harmonium"
import {
  HARMONIUM_PLAY_TEMPO_ORDER,
  HARMONIUM_PLAY_TEMPOS,
  sampleSongTiming,
  westernToHz,
  type HarmoniumKeyboardKey,
  type SheetPlayEvent,
} from "@prabhat/core"
import { playSheetEvents } from "@/lib/harmonium-playback"
import { readErrorDetail } from "@/lib/read-error-detail"

type CaptureEvent = {
  sargam: string
  western: string
  startSec: number
  durationSec: number
}

type CaptureLine = {
  line_number: number
  lyric: string
  lyric_original?: string | null
  status: "empty" | "recorded" | "confirmed"
  events: CaptureEvent[]
  sargam?: string | null
}

type CapturePayload = {
  song_number: number
  title: string
  meaning?: string | null
  hindi_meaning?: string | null
  booklet_locked: boolean
  source_scale: string
  tempo_bpm: number
  can_submit: boolean
  submitted: boolean
  notation_enabled: boolean
  lines: CaptureLine[]
}

type PendingAction = "save" | "confirm" | "retake" | "submit" | "visibility" | "play" | null

const actionButtonClass =
  "outline-button px-4 py-2 text-sm transition-transform duration-75 active:scale-[0.98] disabled:opacity-50 touch-manipulation"
const goldButtonClass =
  "gold-button px-4 py-2 text-sm transition-transform duration-75 active:scale-[0.98] disabled:opacity-50 touch-manipulation"

function eventsToSheet(events: CaptureEvent[]): SheetPlayEvent[] {
  return events.map((event) => ({
    western: event.western,
    frequencyHz: westernToHz(event.western) ?? 261.63,
    startSec: event.startSec,
    durationSec: Math.max(0.12, event.durationSec),
  }))
}

function concatenateLines(lines: CaptureLine[], restSec: number): SheetPlayEvent[] {
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

function canSubmitLines(lines: CaptureLine[]): boolean {
  return lines.length > 0 && lines.every((line) => line.status === "confirmed")
}

function applyLineAction(
  capture: CapturePayload,
  lineNumber: number,
  action: "confirm" | "retake",
): CapturePayload {
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

const CaptureKeyboard = memo(function CaptureKeyboard({
  tonic,
  onTonicChange,
  onPressKey,
  onReleaseKey,
}: {
  tonic: string
  onTonicChange: (tonic: string) => void
  onPressKey: (key: HarmoniumKeyboardKey) => void
  onReleaseKey: (key: HarmoniumKeyboardKey) => void
}) {
  return (
    <VirtualHarmonium
      tonic={tonic}
      onTonicChange={onTonicChange}
      keyboardOnly
      onPressKey={onPressKey}
      onReleaseKey={onReleaseKey}
    />
  )
})

export function AdminSargamPanel({ initialNumber }: { initialNumber?: number }) {
  const router = useRouter()
  const [songNumber, setSongNumber] = useState(initialNumber ? String(initialNumber) : "")
  const [capture, setCapture] = useState<CapturePayload | null>(null)
  const [loading, setLoading] = useState(Boolean(initialNumber))
  const [error, setError] = useState("")
  const [recording, setRecording] = useState(false)
  const [studioOpen, setStudioOpen] = useState(false)
  const [activeLine, setActiveLine] = useState(1)
  const [notesCaptured, setNotesCaptured] = useState(0)
  const [tonic, setTonic] = useState("C")
  const [tempoBpm, setTempoBpm] = useState(HARMONIUM_PLAY_TEMPOS.medium.bpm)
  const [pending, setPending] = useState<PendingAction>(null)
  const originMs = useRef(0)
  const pendingKeys = useRef(new Map<string, { startMs: number; key: HarmoniumKeyboardKey }>())
  const liveEventsRef = useRef<CaptureEvent[]>([])
  const recordingRef = useRef(false)
  const captureRef = useRef<CapturePayload | null>(null)

  useEffect(() => {
    recordingRef.current = recording
  }, [recording])

  useEffect(() => {
    captureRef.current = capture
  }, [capture])

  const loadCapture = useCallback(async (number: number) => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/admin/sargam-capture/${number}`)
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setCapture(null)
        setError(readErrorDetail(body, "Could not load this song"))
        return
      }
      const payload = body as CapturePayload
      setCapture(payload)
      setTonic(payload.source_scale || "C")
      setTempoBpm(payload.tempo_bpm || HARMONIUM_PLAY_TEMPOS.medium.bpm)
      const firstOpen = payload.lines.find((line) => line.status !== "confirmed")
      setActiveLine(firstOpen?.line_number || payload.lines[0]?.line_number || 1)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialNumber) void loadCapture(initialNumber)
  }, [initialNumber, loadCapture])

  async function fetchSong(event: React.FormEvent) {
    event.preventDefault()
    const number = Number(songNumber)
    if (!Number.isInteger(number) || number < 1) {
      setError("Enter a song number")
      return
    }
    router.push(`/admin/sargam/${number}`)
    await loadCapture(number)
  }

  const currentLine = capture?.lines.find((line) => line.line_number === activeLine)

  const onPressKey = useCallback((key: HarmoniumKeyboardKey) => {
    if (!recordingRef.current) return
    pendingKeys.current.set(key.western, { startMs: Date.now(), key })
  }, [])

  const onReleaseKey = useCallback((key: HarmoniumKeyboardKey) => {
    if (!recordingRef.current) return
    const held = pendingKeys.current.get(key.western)
    pendingKeys.current.delete(key.western)
    if (!held) return
    const startSec = Math.max(0, (held.startMs - originMs.current) / 1000)
    const durationSec = Math.max(0.12, (Date.now() - held.startMs) / 1000)
    const octave = Number(key.western.slice(-1))
    const sargam =
      octave <= 3 ? `.${key.token}` : octave >= 5 ? `${key.token}'` : key.token
    liveEventsRef.current.push({ sargam, western: key.western, startSec, durationSec })
    setNotesCaptured(liveEventsRef.current.length)
  }, [])

  function startRecord() {
    if (capture?.booklet_locked) return
    pendingKeys.current.clear()
    liveEventsRef.current = []
    setNotesCaptured(0)
    originMs.current = Date.now()
    recordingRef.current = true
    setRecording(true)
  }

  async function stopAndSave() {
    const snapshot = captureRef.current
    const line = snapshot?.lines.find((item) => item.line_number === activeLine)
    if (!snapshot || !line) return
    recordingRef.current = false
    setRecording(false)
    const events = [...liveEventsRef.current]
    if (!events.length) return
    setPending("save")
    setError("")
    try {
      const response = await fetch(
        `/api/admin/sargam-capture/${snapshot.song_number}/lines/${line.line_number}/takes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events, source_scale: tonic, tempo_bpm: tempoBpm }),
        },
      )
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, "Could not save this take"))
        return
      }
      setCapture(body as CapturePayload)
      liveEventsRef.current = []
      setNotesCaptured(0)
    } finally {
      setPending(null)
    }
  }

  async function postLine(action: "confirm" | "retake") {
    const snapshot = captureRef.current
    const line = snapshot?.lines.find((item) => item.line_number === activeLine)
    if (!snapshot || !line || pending) return

    const previous = snapshot
    const optimistic = applyLineAction(snapshot, line.line_number, action)
    setCapture(optimistic)
    if (action === "confirm") {
      const next = optimistic.lines.find((item) => item.status !== "confirmed")
      if (next) setActiveLine(next.line_number)
    } else {
      liveEventsRef.current = []
      setNotesCaptured(0)
    }

    setPending(action === "confirm" ? "confirm" : "retake")
    setError("")
    try {
      const response = await fetch(
        `/api/admin/sargam-capture/${snapshot.song_number}/lines/${line.line_number}/${action}`,
        { method: "POST" },
      )
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setCapture(previous)
        setError(readErrorDetail(body, `Could not ${action} this line`))
        return
      }
      setCapture(body as CapturePayload)
    } finally {
      setPending(null)
    }
  }

  async function playEvents(events: CaptureEvent[]) {
    if (!events.length || pending === "play") return
    setPending("play")
    try {
      await playSheetEvents(eventsToSheet(events))
    } finally {
      setPending(null)
    }
  }

  async function playFinal() {
    const snapshot = captureRef.current
    if (!snapshot || pending === "play") return
    setPending("play")
    try {
      const timing = sampleSongTiming(tempoBpm)
      await playSheetEvents(concatenateLines(snapshot.lines, timing.lineRestSec))
    } finally {
      setPending(null)
    }
  }

  async function submitSong() {
    const snapshot = captureRef.current
    if (!snapshot || pending) return
    setPending("submit")
    setError("")
    try {
      const response = await fetch(`/api/admin/sargam-capture/${snapshot.song_number}/submit`, {
        method: "POST",
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, "Could not submit this song"))
        return
      }
      setCapture(body as CapturePayload)
    } finally {
      setPending(null)
    }
  }

  async function setNotationEnabled(enabled: boolean) {
    const snapshot = captureRef.current
    if (!snapshot || pending) return
    const previous = snapshot
    setCapture({ ...snapshot, notation_enabled: enabled })
    setPending("visibility")
    setError("")
    try {
      const response = await fetch(`/api/admin/sargam-capture/${snapshot.song_number}/visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setCapture(previous)
        setError(readErrorDetail(body, "Could not update notation visibility"))
        return
      }
      setCapture(body as CapturePayload)
    } finally {
      setPending(null)
    }
  }

  const lineEvents = currentLine?.events || []
  const previewEvents = recording && notesCaptured > 0 ? liveEventsRef.current : lineEvents
  const playDisabled = previewEvents.length === 0 || pending === "play"
  const replayDisabled = lineEvents.length === 0 || pending === "play"

  return (
    <AdminShell
      active="sargam"
      title="Sargam capture"
      description="Enter a song number. Lyrics and meaning load from the catalog. Then record each line on the virtual harmonium."
    >
      <form onSubmit={(event) => void fetchSong(event)} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-[0.16em] text-gold-700">
          Song number
          <input
            type="number"
            min={1}
            value={songNumber}
            onChange={(event) => setSongNumber(event.target.value)}
            className="w-32 rounded-xl border border-gold-500/40 bg-white px-3 py-2.5 text-base font-semibold text-navy-950"
            aria-label="Song number"
          />
        </label>
        <button type="submit" className={goldButtonClass} disabled={loading}>
          {loading ? "Loading…" : "Load lyrics"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {capture ? (
        <section className="mt-6 space-y-5">
          <div className="rounded-2xl border border-navy-900/10 bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-700">
              Song {capture.song_number}
            </p>
            <h2 className="mt-2 font-serif text-3xl text-navy-950">{capture.title}</h2>
            {capture.booklet_locked ? (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Songs 1, 2, and 27 already have booklet sargam. Recording is locked so those copies are not overwritten.
              </p>
            ) : null}
            {capture.submitted ? (
              <p className="mt-3 text-sm font-semibold text-emerald-800">This song’s sargam is already submitted.</p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-900/10 bg-ivory-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-navy-950">Show notation on the song page</p>
                <p className="mt-1 text-xs text-stone-600">
                  {capture.notation_enabled
                    ? "Learners currently see sargam for this song."
                    : "Notation is hidden from learners until you enable it."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={capture.notation_enabled}
                aria-label="Show notation for this song"
                disabled={pending === "visibility"}
                onClick={() => void setNotationEnabled(!capture.notation_enabled)}
                className={`relative h-8 w-14 rounded-full transition-colors duration-150 ${
                  capture.notation_enabled ? "bg-navy-950" : "bg-stone-300"
                }`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-transform duration-150 ${
                    capture.notation_enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {capture.meaning ? (
              <div className="mt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Meaning</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">{capture.meaning}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-stone-500">No English meaning in the catalog for this song.</p>
            )}
            {capture.hindi_meaning ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700" lang="hi">
                {capture.hindi_meaning}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-navy-900/10 bg-ivory-50 p-5">
            <p className="eyebrow">Lyrics</p>
            <ol className="mt-3 space-y-2">
              {capture.lines.map((line) => (
                <li key={line.line_number}>
                  <button
                    type="button"
                    onClick={() => setActiveLine(line.line_number)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors duration-75 active:scale-[0.99] touch-manipulation ${
                      activeLine === line.line_number
                        ? "border-gold-500/40 bg-gold-50"
                        : "border-navy-900/8 bg-white hover:bg-gold-50/40"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase text-gold-700">
                      Line {line.line_number} · {line.status}
                    </span>
                    <p className="mt-1 font-serif text-navy-950">{line.lyric}</p>
                    {line.sargam ? (
                      <p className="mt-1 font-serif text-sm text-gold-900">{line.sargam}</p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ol>
            {!studioOpen ? (
              <button
                type="button"
                className={`${goldButtonClass} mt-4`}
                onClick={() => setStudioOpen(true)}
                disabled={!capture.lines.length || capture.booklet_locked}
              >
                Start recording lyrics
              </button>
            ) : null}
          </div>

          {studioOpen ? (
            <div className="space-y-4">
              <div className="sticky bottom-auto top-0 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-navy-900/10 bg-white p-3 shadow-sm">
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={() => void playEvents(previewEvents)}
                  disabled={playDisabled}
                >
                  {pending === "play" ? "Playing…" : "Play this line"}
                </button>
                {recording ? (
                  <button
                    type="button"
                    className={goldButtonClass}
                    onClick={() => void stopAndSave()}
                    disabled={pending === "save" || notesCaptured === 0}
                  >
                    {pending === "save" ? "Saving…" : "Stop & save take"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={goldButtonClass}
                    onClick={startRecord}
                    disabled={capture.booklet_locked || currentLine?.status === "confirmed"}
                  >
                    Record
                  </button>
                )}
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={() => void playEvents(lineEvents)}
                  disabled={replayDisabled}
                >
                  Replay
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={() => void postLine("confirm")}
                  disabled={pending === "confirm" || currentLine?.status !== "recorded"}
                >
                  {pending === "confirm" ? "Confirming…" : "Confirm"}
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={() => void postLine("retake")}
                  disabled={pending === "retake" || currentLine?.status === "empty"}
                >
                  {pending === "retake" ? "Resetting…" : "Retake"}
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={() => void playFinal()}
                  disabled={
                    pending === "play" ||
                    (!capture.can_submit && !capture.lines.every((line) => line.status === "confirmed"))
                  }
                >
                  Final play
                </button>
                <button
                  type="button"
                  className={goldButtonClass}
                  onClick={() => void submitSong()}
                  disabled={pending === "submit" || !capture.can_submit}
                >
                  {pending === "submit" ? "Submitting…" : "Submit song"}
                </button>
                {recording ? (
                  <span className="text-xs font-semibold text-red-700">
                    Recording… {notesCaptured} note{notesCaptured === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>

              {currentLine ? (
                <p className="font-serif text-xl text-navy-950">
                  Recording: {currentLine.lyric}
                </p>
              ) : null}

              <CaptureKeyboard
                tonic={tonic}
                onTonicChange={setTonic}
                onPressKey={onPressKey}
                onReleaseKey={onReleaseKey}
              />

              <div className="flex flex-wrap gap-2">
                {HARMONIUM_PLAY_TEMPO_ORDER.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTempoBpm(HARMONIUM_PLAY_TEMPOS[id].bpm)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-75 active:scale-[0.98] touch-manipulation ${
                      tempoBpm === HARMONIUM_PLAY_TEMPOS[id].bpm
                        ? "bg-navy-950 text-white"
                        : "bg-white text-navy-950 hover:bg-gold-50"
                    }`}
                  >
                    {HARMONIUM_PLAY_TEMPOS[id].label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </AdminShell>
  )
}
