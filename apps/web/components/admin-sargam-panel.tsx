"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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

export function AdminSargamPanel({ initialNumber }: { initialNumber?: number }) {
  const router = useRouter()
  const [songNumber, setSongNumber] = useState(initialNumber ? String(initialNumber) : "")
  const [capture, setCapture] = useState<CapturePayload | null>(null)
  const [loading, setLoading] = useState(Boolean(initialNumber))
  const [error, setError] = useState("")
  const [recording, setRecording] = useState(false)
  const [studioOpen, setStudioOpen] = useState(false)
  const [activeLine, setActiveLine] = useState(1)
  const [liveEvents, setLiveEvents] = useState<CaptureEvent[]>([])
  const [tonic, setTonic] = useState("C")
  const [tempoBpm, setTempoBpm] = useState(HARMONIUM_PLAY_TEMPOS.medium.bpm)
  const [saving, setSaving] = useState(false)
  const originMs = useRef(0)
  const pending = useRef(new Map<string, { startMs: number; key: HarmoniumKeyboardKey }>())

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
    if (!recording) return
    pending.current.set(key.western, { startMs: Date.now(), key })
  }, [recording])

  const onReleaseKey = useCallback((key: HarmoniumKeyboardKey) => {
    if (!recording) return
    const held = pending.current.get(key.western)
    pending.current.delete(key.western)
    if (!held) return
    const startSec = Math.max(0, (held.startMs - originMs.current) / 1000)
    const durationSec = Math.max(0.12, (Date.now() - held.startMs) / 1000)
    const octave = Number(key.western.slice(-1))
    const sargam =
      octave <= 3 ? `.${key.token}` : octave >= 5 ? `${key.token}'` : key.token
    setLiveEvents((current) => [
      ...current,
      { sargam, western: key.western, startSec, durationSec },
    ])
  }, [recording])

  function startRecord() {
    if (capture?.booklet_locked) return
    pending.current.clear()
    originMs.current = Date.now()
    setLiveEvents([])
    setRecording(true)
  }

  async function stopAndSave() {
    if (!capture || !currentLine) return
    setRecording(false)
    const events = [...liveEvents]
    if (!events.length) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch(
        `/api/admin/sargam-capture/${capture.song_number}/lines/${currentLine.line_number}/takes`,
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
      setLiveEvents([])
    } finally {
      setSaving(false)
    }
  }

  async function postLine(action: "confirm" | "retake") {
    if (!capture || !currentLine) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch(
        `/api/admin/sargam-capture/${capture.song_number}/lines/${currentLine.line_number}/${action}`,
        { method: "POST" },
      )
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, `Could not ${action} this line`))
        return
      }
      const payload = body as CapturePayload
      setCapture(payload)
      if (action === "confirm") {
        const next = payload.lines.find((line) => line.status !== "confirmed")
        if (next) setActiveLine(next.line_number)
      } else {
        setLiveEvents([])
      }
    } finally {
      setSaving(false)
    }
  }

  async function playEvents(events: CaptureEvent[]) {
    if (!events.length) return
    await playSheetEvents(eventsToSheet(events))
  }

  async function playFinal() {
    if (!capture) return
    const timing = sampleSongTiming(tempoBpm)
    await playSheetEvents(concatenateLines(capture.lines, timing.lineRestSec))
  }

  async function submitSong() {
    if (!capture) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch(`/api/admin/sargam-capture/${capture.song_number}/submit`, {
        method: "POST",
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, "Could not submit this song"))
        return
      }
      setCapture(body as CapturePayload)
    } finally {
      setSaving(false)
    }
  }

  async function setNotationEnabled(enabled: boolean) {
    if (!capture) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch(`/api/admin/sargam-capture/${capture.song_number}/visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, "Could not update notation visibility"))
        return
      }
      setCapture(body as CapturePayload)
    } finally {
      setSaving(false)
    }
  }

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
        <button type="submit" className="gold-button px-5 py-2.5 text-sm" disabled={loading}>
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
                disabled={saving}
                onClick={() => void setNotationEnabled(!capture.notation_enabled)}
                className={`relative h-8 w-14 rounded-full transition ${
                  capture.notation_enabled ? "bg-navy-950" : "bg-stone-300"
                }`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
                    capture.notation_enabled ? "left-7" : "left-1"
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
                    className={`w-full rounded-xl border px-3 py-2 text-left ${
                      activeLine === line.line_number
                        ? "border-gold-500/40 bg-gold-50"
                        : "border-navy-900/8 bg-white"
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
                className="gold-button mt-4 px-5 py-2.5 text-sm"
                onClick={() => setStudioOpen(true)}
                disabled={!capture.lines.length || capture.booklet_locked}
              >
                Start recording lyrics
              </button>
            ) : null}
          </div>

          {studioOpen ? (
            <div className="space-y-4">
              <div className="sticky bottom-auto top-0 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-navy-900/10 bg-white p-3">
                <button
                  type="button"
                  className="outline-button px-4 py-2 text-sm"
                  onClick={() => void playEvents(currentLine?.events || liveEvents)}
                  disabled={!((currentLine?.events.length || liveEvents.length) > 0)}
                >
                  Play this line
                </button>
                {recording ? (
                  <button type="button" className="gold-button px-4 py-2 text-sm" onClick={() => void stopAndSave()}>
                    Stop & save take
                  </button>
                ) : (
                  <button
                    type="button"
                    className="gold-button px-4 py-2 text-sm"
                    onClick={startRecord}
                    disabled={capture.booklet_locked || currentLine?.status === "confirmed"}
                  >
                    Record
                  </button>
                )}
                <button
                  type="button"
                  className="outline-button px-4 py-2 text-sm"
                  onClick={() => void playEvents(currentLine?.events || [])}
                  disabled={!currentLine?.events.length}
                >
                  Replay
                </button>
                <button
                  type="button"
                  className="outline-button px-4 py-2 text-sm"
                  onClick={() => void postLine("confirm")}
                  disabled={saving || currentLine?.status !== "recorded"}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="outline-button px-4 py-2 text-sm"
                  onClick={() => void postLine("retake")}
                  disabled={saving || currentLine?.status === "empty"}
                >
                  Retake
                </button>
                <button
                  type="button"
                  className="outline-button px-4 py-2 text-sm"
                  onClick={() => void playFinal()}
                  disabled={!capture.can_submit && !capture.lines.every((line) => line.status === "confirmed")}
                >
                  Final play
                </button>
                <button
                  type="button"
                  className="gold-button px-4 py-2 text-sm"
                  onClick={() => void submitSong()}
                  disabled={saving || !capture.can_submit}
                >
                  Submit song
                </button>
                {recording ? <span className="text-xs font-semibold text-red-700">Recording… play this lyric line</span> : null}
              </div>

              {currentLine ? (
                <p className="font-serif text-xl text-navy-950">
                  Recording: {currentLine.lyric}
                </p>
              ) : null}

              <VirtualHarmonium
                tonic={tonic}
                onTonicChange={setTonic}
                keyboardOnly
                onPressKey={onPressKey}
                onReleaseKey={onReleaseKey}
              />

              <div className="flex flex-wrap gap-2">
                {HARMONIUM_PLAY_TEMPO_ORDER.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTempoBpm(HARMONIUM_PLAY_TEMPOS[id].bpm)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      tempoBpm === HARMONIUM_PLAY_TEMPOS[id].bpm
                        ? "bg-navy-950 text-white"
                        : "bg-white text-navy-950"
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
