"use client"

import { memo, useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { AdminShell } from "@/components/admin-shell"
import { VirtualHarmonium } from "@/components/virtual-harmonium"
import {
  BANDHU_HE_NIYE_CALO_SONG,
  HARMONIUM_PLAY_TEMPOS,
  parseSargamInput,
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

type CaptureMutation = {
  song_number: number
  source_scale: string
  tempo_bpm: number
  can_submit: boolean
  submitted: boolean
  notation_enabled?: boolean | null
  line?: CaptureLine | null
}

type CapturePayload = CaptureMutation & {
  title: string
  booklet_locked: boolean
  notation_enabled: boolean
  listen_url?: string | null
  lines: CaptureLine[]
}

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

export function learnerNotationVisible(enabled: boolean | null | undefined): boolean {
  return enabled === true
}

function normalizeCapturePayload(capture: CapturePayload): CapturePayload {
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

function sargamTextToEvents(text: string, tonic: string, tempoBpm: number): CaptureEvent[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const timing = sampleSongTiming(tempoBpm)
  const swaras = parseSargamInput(trimmed, tonic)
  const events: CaptureEvent[] = []
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

function applySavedTake(
  capture: CapturePayload,
  lineNumber: number,
  events: CaptureEvent[],
): CapturePayload {
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

function mergeMutation(current: CapturePayload, patch: CaptureMutation): CapturePayload {
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

const CaptureHarmonium = memo(function CaptureHarmonium({
  tonic,
  onTonicChange,
  tempoBpm,
  onTempoBpmChange,
  onPressKey,
  onReleaseKey,
}: {
  tonic: string
  onTonicChange: (tonic: string) => void
  tempoBpm: number
  onTempoBpmChange: (bpm: number) => void
  onPressKey: (key: HarmoniumKeyboardKey) => void
  onReleaseKey: (key: HarmoniumKeyboardKey) => void
}) {
  return (
    <VirtualHarmonium
      tonic={tonic}
      onTonicChange={onTonicChange}
      tempoBpm={tempoBpm}
      onTempoBpmChange={onTempoBpmChange}
      captureMode
      song={BANDHU_HE_NIYE_CALO_SONG}
      onPressKey={onPressKey}
      onReleaseKey={onReleaseKey}
    />
  )
})

const LyricLines = memo(function LyricLines({
  lines,
  activeLine,
  onSelect,
}: {
  lines: CaptureLine[]
  activeLine: number
  onSelect: (lineNumber: number) => void
}) {
  return (
    <ol className="mt-3 space-y-2">
      {lines.map((line) => (
        <li key={line.line_number}>
          <button
            type="button"
            onClick={() => onSelect(line.line_number)}
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
  const [pasteText, setPasteText] = useState("")
  const [tonic, setTonic] = useState("C")
  const [tempoBpm, setTempoBpm] = useState(HARMONIUM_PLAY_TEMPOS.medium.bpm)
  const [playing, setPlaying] = useState(false)
  const [pendingSave, setPendingSave] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState(false)
  const [pendingRetake, setPendingRetake] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState(false)
  const originMs = useRef(0)
  const pendingKeys = useRef(new Map<string, { startMs: number; key: HarmoniumKeyboardKey }>())
  const liveEventsRef = useRef<CaptureEvent[]>([])
  const recordingRef = useRef(false)
  const captureRef = useRef<CapturePayload | null>(null)
  const playingRef = useRef(false)

  useEffect(() => {
    recordingRef.current = recording
  }, [recording])

  useEffect(() => {
    captureRef.current = capture
  }, [capture])

  useEffect(() => {
    setPasteText("")
  }, [activeLine])

  const loadCapture = useCallback(async (number: number) => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/admin/sargam-capture/${number}`, { cache: "no-store" })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setCapture(null)
        setStudioOpen(false)
        setError(readErrorDetail(body, "Could not load this song"))
        return
      }
      const payload = normalizeCapturePayload(body as CapturePayload)
      setCapture(payload)
      captureRef.current = payload
      setTonic(payload.source_scale || "C")
      setTempoBpm(payload.tempo_bpm || HARMONIUM_PLAY_TEMPOS.medium.bpm)
      const firstOpen = payload.lines.find((line) => line.status !== "confirmed")
      setActiveLine(firstOpen?.line_number || payload.lines[0]?.line_number || 1)
      setStudioOpen(Boolean(payload.lines.length) && !payload.booklet_locked)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialNumber) void loadCapture(initialNumber)
  }, [initialNumber, loadCapture])

  function fetchSong(event: React.FormEvent) {
    event.preventDefault()
    const number = Number(songNumber)
    if (!Number.isInteger(number) || number < 1) {
      setError("Enter a song number")
      return
    }
    setError("")
    if (initialNumber !== number) {
      router.push(`/admin/sargam/${number}`)
      return
    }
    void loadCapture(number)
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

  function cancelRecording() {
    pendingKeys.current.clear()
    liveEventsRef.current = []
    setNotesCaptured(0)
    recordingRef.current = false
    setRecording(false)
  }

  function selectLine(lineNumber: number) {
    if (activeLine === lineNumber) return
    cancelRecording()
    setActiveLine(lineNumber)
    setPasteText("")
  }

  function stepLine(delta: -1 | 1) {
    const snapshot = captureRef.current
    if (!snapshot?.lines.length) return
    const index = snapshot.lines.findIndex((line) => line.line_number === activeLine)
    if (index < 0) return
    const nextIndex = index + delta
    if (nextIndex < 0 || nextIndex >= snapshot.lines.length) return
    selectLine(snapshot.lines[nextIndex].line_number)
  }

  function startRecord() {
    if (capture?.booklet_locked) return
    pendingKeys.current.clear()
    liveEventsRef.current = []
    setNotesCaptured(0)
    originMs.current = Date.now()
    recordingRef.current = true
    setRecording(true)
  }

  async function persistTake(events: CaptureEvent[]) {
    const snapshot = captureRef.current
    const line = snapshot?.lines.find((item) => item.line_number === activeLine)
    if (!snapshot || !line || !events.length) return

    const previous = snapshot
    const optimistic = applySavedTake(snapshot, line.line_number, events)
    setCapture(optimistic)
    captureRef.current = optimistic
    liveEventsRef.current = []
    setNotesCaptured(0)
    recordingRef.current = false
    setRecording(false)

    setPendingSave(true)
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
        setCapture(previous)
        captureRef.current = previous
        setError(readErrorDetail(body, "Could not save this take"))
        return
      }
      const merged = mergeMutation(optimistic, body as CaptureMutation)
      setCapture(merged)
      captureRef.current = merged
    } finally {
      setPendingSave(false)
    }
  }

  async function stopAndSave() {
    const events = [...liveEventsRef.current]
    if (!events.length) return
    await persistTake(events)
  }

  async function savePastedSargam() {
    const events = sargamTextToEvents(pasteText, tonic, tempoBpm)
    if (!events.length) {
      setError("Paste sargam like Sa Re Ga Ma or सा रे ग म")
      return
    }
    await persistTake(events)
    setPasteText("")
  }

  async function postLine(action: "confirm" | "retake") {
    const snapshot = captureRef.current
    const line = snapshot?.lines.find((item) => item.line_number === activeLine)
    if (!snapshot || !line) return

    const previous = snapshot
    const optimistic = applyLineAction(snapshot, line.line_number, action)
    setCapture(optimistic)
    captureRef.current = optimistic
    if (action === "confirm") {
      const next = optimistic.lines.find((item) => item.status !== "confirmed")
      if (next) selectLine(next.line_number)
    } else {
      liveEventsRef.current = []
      setNotesCaptured(0)
      setPasteText("")
    }

    const setPending = action === "confirm" ? setPendingConfirm : setPendingRetake
    setPending(true)
    setError("")
    try {
      const response = await fetch(
        `/api/admin/sargam-capture/${snapshot.song_number}/lines/${line.line_number}/${action}`,
        { method: "POST" },
      )
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setCapture(previous)
        captureRef.current = previous
        setError(readErrorDetail(body, `Could not ${action} this line`))
        return
      }
      const merged = mergeMutation(optimistic, body as CaptureMutation)
      setCapture(merged)
      captureRef.current = merged
    } finally {
      setPending(false)
    }
  }

  async function playEvents(events: CaptureEvent[]) {
    if (!events.length || playingRef.current) return
    playingRef.current = true
    setPlaying(true)
    try {
      await playSheetEvents(eventsToSheet(events))
    } finally {
      playingRef.current = false
      setPlaying(false)
    }
  }

  async function playFinal() {
    const snapshot = captureRef.current
    if (!snapshot || playingRef.current) return
    playingRef.current = true
    setPlaying(true)
    try {
      const timing = sampleSongTiming(tempoBpm)
      await playSheetEvents(concatenateLines(snapshot.lines, timing.lineRestSec))
    } finally {
      playingRef.current = false
      setPlaying(false)
    }
  }

  async function submitSong() {
    const snapshot = captureRef.current
    if (!snapshot) return
    setPendingSubmit(true)
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
      const patch = body as CaptureMutation
      setCapture((current) => (current ? mergeMutation(current, patch) : current))
      captureRef.current =
        captureRef.current && patch ? mergeMutation(captureRef.current, patch) : captureRef.current
    } finally {
      setPendingSubmit(false)
    }
  }

  function setNotationEnabled(enabled: boolean) {
    const snapshot = captureRef.current
    if (!snapshot || learnerNotationVisible(snapshot.notation_enabled) === enabled) return
    const previous = snapshot
    const optimistic = { ...snapshot, notation_enabled: enabled }
    setCapture(optimistic)
    captureRef.current = optimistic
    setError("")
    void fetch(`/api/admin/sargam-capture/${snapshot.song_number}/visibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (!response.ok) {
          setCapture(previous)
          captureRef.current = previous
          setError(readErrorDetail(body, "Could not update notation visibility"))
          return
        }
        setCapture((current) => (current ? mergeMutation(current, body as CaptureMutation) : current))
        if (captureRef.current) {
          captureRef.current = mergeMutation(captureRef.current, body as CaptureMutation)
        }
      })
      .catch(() => {
        setCapture(previous)
        captureRef.current = previous
        setError("Could not update notation visibility")
      })
  }

  const lineEvents = currentLine?.events || []
  const previewEvents = recording && notesCaptured > 0 ? liveEventsRef.current : lineEvents
  const activeLineIndex = capture?.lines.findIndex((line) => line.line_number === activeLine) ?? -1
  const lineCount = capture?.lines.length ?? 0
  const learnerVisible = capture ? learnerNotationVisible(capture.notation_enabled) : false

  return (
    <AdminShell
      active="sargam"
      title="Sargam capture"
      description="Enter a song number to load lyrics, then record or paste sargam line by line."
    >
      <form onSubmit={fetchSong} className="flex flex-wrap items-end gap-3">
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
          {loading ? "Loading…" : "Load song"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {capture ? (
        <section className="mt-6 space-y-5">
          <div className="rounded-2xl border border-navy-900/10 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-700">
                  Song {capture.song_number}
                </p>
                <h2 className="mt-2 font-serif text-3xl text-navy-950">{capture.title}</h2>
              </div>
              <div className="min-w-[14rem] rounded-2xl border border-navy-900/10 bg-ivory-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-700">
                  Learner notation
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  {learnerVisible
                    ? "Harmonium and sargam are visible on the song page."
                    : "Hidden from learners until you show it again."}
                </p>
                <div
                  className="mt-3 flex flex-wrap gap-2"
                  role="group"
                  aria-label="Learner notation visibility"
                >
                  <button
                    type="button"
                    className={`${actionButtonClass} ${learnerVisible ? "bg-navy-950 text-white" : ""}`}
                    aria-pressed={learnerVisible}
                    onClick={() => setNotationEnabled(true)}
                  >
                    Show learners
                  </button>
                  <button
                    type="button"
                    className={`${actionButtonClass} ${!learnerVisible ? "bg-navy-950 text-white" : ""}`}
                    aria-pressed={!learnerVisible}
                    onClick={() => setNotationEnabled(false)}
                  >
                    Hide learners
                  </button>
                </div>
              </div>
            </div>
            {capture.booklet_locked ? (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Songs 1, 2, and 27 already have booklet sargam. Recording is locked so those copies are not overwritten.
              </p>
            ) : null}
            {capture.submitted ? (
              <p className="mt-3 text-sm font-semibold text-emerald-800">This song’s sargam is already submitted.</p>
            ) : null}
            {capture.listen_url ? (
              <div className="mt-4 rounded-xl border border-navy-900/10 bg-ivory-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Listen while you capture</p>
                <audio controls preload="none" src={capture.listen_url} className="mt-2 w-full" />
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-navy-900/10 bg-ivory-50 p-5">
            <p className="eyebrow">Lyrics</p>
            <LyricLines lines={capture.lines} activeLine={activeLine} onSelect={selectLine} />
          </div>

          {studioOpen ? (
            <div className="space-y-4">
              <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-navy-900/10 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-1 rounded-full border border-navy-900/10 bg-ivory-50 p-1">
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={() => stepLine(-1)}
                    disabled={activeLineIndex <= 0}
                    aria-label="Previous line"
                  >
                    ← Prev
                  </button>
                  <span className="px-2 text-xs font-semibold tabular-nums text-navy-950">
                    {activeLineIndex >= 0 ? activeLineIndex + 1 : "–"} / {lineCount || "–"}
                  </span>
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={() => stepLine(1)}
                    disabled={activeLineIndex < 0 || activeLineIndex >= lineCount - 1}
                    aria-label="Next line"
                  >
                    Next →
                  </button>
                </div>
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={() => void playEvents(previewEvents)}
                  disabled={previewEvents.length === 0 || playing}
                >
                  {playing ? "Playing…" : "Play line"}
                </button>
                {recording ? (
                  <button
                    type="button"
                    className={goldButtonClass}
                    onClick={() => void stopAndSave()}
                    disabled={notesCaptured === 0}
                  >
                    {pendingSave ? "Saving…" : "Stop & save"}
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
                  disabled={lineEvents.length === 0 || playing}
                >
                  Replay saved
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={() => void postLine("confirm")}
                  disabled={pendingConfirm || currentLine?.status !== "recorded"}
                >
                  {pendingConfirm ? "Confirming…" : "Confirm"}
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={() => void postLine("retake")}
                  disabled={pendingRetake || currentLine?.status === "empty"}
                >
                  {pendingRetake ? "Resetting…" : "Retake"}
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={() => void playFinal()}
                  disabled={
                    playing ||
                    (!capture.can_submit && !capture.lines.every((line) => line.status === "confirmed"))
                  }
                >
                  Play full song
                </button>
                <button
                  type="button"
                  className={goldButtonClass}
                  onClick={() => void submitSong()}
                  disabled={pendingSubmit || !capture.can_submit}
                >
                  {pendingSubmit ? "Submitting…" : "Submit song"}
                </button>
                {recording ? (
                  <span className="text-xs font-semibold text-red-700">
                    Recording… {notesCaptured} note{notesCaptured === 1 ? "" : "s"}
                  </span>
                ) : null}
                {pendingSave ? <span className="text-xs text-stone-500">Syncing take…</span> : null}
              </div>

              {currentLine ? (
                <p className="font-serif text-xl text-navy-950">Line {currentLine.line_number}: {currentLine.lyric}</p>
              ) : null}

              <div className="rounded-2xl border border-navy-900/10 bg-white p-4">
                <label className="text-xs font-bold uppercase tracking-[0.16em] text-gold-700" htmlFor="paste-sargam">
                  Paste sargam for this line
                </label>
                <textarea
                  id="paste-sargam"
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  placeholder="Sa Re Ga Ma Pa… or सा रे ग म प…"
                  rows={2}
                  className="mt-2 w-full rounded-xl border border-gold-500/30 bg-ivory-50 px-3 py-2 text-sm text-navy-950"
                />
                <button
                  type="button"
                  className={`${goldButtonClass} mt-2`}
                  onClick={() => void savePastedSargam()}
                  disabled={!pasteText.trim() || capture.booklet_locked || currentLine?.status === "confirmed"}
                >
                  Save pasted sargam
                </button>
              </div>

              <CaptureHarmonium
                tonic={tonic}
                onTonicChange={setTonic}
                tempoBpm={tempoBpm}
                onTempoBpmChange={setTempoBpm}
                onPressKey={onPressKey}
                onReleaseKey={onReleaseKey}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </AdminShell>
  )
}
