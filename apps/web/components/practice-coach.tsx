"use client"

import { useEffect, useRef, useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import type { TransposedNotation } from "@/lib/api"
import { compareLyricsTranscript } from "@/lib/lyrics-practice"
import type { LyricsPracticeResult } from "@/lib/lyrics-practice"
import { comparePitchSequence, expectedMidi, extractPitchTrack, unavailablePracticeResult } from "@/lib/practice-analysis"
import type { PracticeResult } from "@/lib/practice-analysis"
import { speechCaptureSupported, startSpeechCapture } from "@/lib/speech-capture"

type CoachAnalysis = {
  melody: PracticeResult
  lyrics: LyricsPracticeResult | null
}

export function PracticeCoach({
  notation,
  lyricLines = [],
}: {
  notation: TransposedNotation | null
  lyricLines?: string[]
}) {
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState<CoachAnalysis | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const recordingTimer = useRef<number | null>(null)
  const speechStop = useRef<(() => void) | null>(null)
  const heardTranscript = useRef("")
  const [lyricsSupported, setLyricsSupported] = useState(false)

  useEffect(() => {
    setLyricsSupported(speechCaptureSupported() && lyricLines.some((line) => line.trim()))
  }, [lyricLines])

  useEffect(() => () => {
    if (recordingTimer.current) window.clearInterval(recordingTimer.current)
    speechStop.current?.()
    if (recorder.current?.state === "recording") recorder.current.stop()
  }, [])

  async function analyze(blob: Blob, transcript: string) {
    if (!notation) return
    if (blob.size > 20 * 1024 * 1024) {
      setResult({
        melody: unavailablePracticeResult("analysis_error", "Choose an audio recording smaller than 20 MB."),
        lyrics: null,
      })
      return
    }
    setWorking(true)
    setResult(null)
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    let context: AudioContext | null = null
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) throw new Error("Audio analysis is not supported")
      context = new AudioContextClass()
      const buffer = await context.decodeAudioData(await blob.arrayBuffer())
      if (buffer.duration > 60) {
        setResult({
          melody: unavailablePracticeResult("analysis_error", "Choose a focused practice excerpt of one minute or less."),
          lyrics: null,
        })
      } else {
        const melody = comparePitchSequence(
          extractPitchTrack(buffer.getChannelData(0), buffer.sampleRate),
          expectedMidi(notation),
        )
        const lyrics = transcript.trim() && lyricLines.length
          ? compareLyricsTranscript(transcript, lyricLines)
          : null
        setResult({ melody, lyrics })
      }
    } catch {
      setResult({
        melody: unavailablePracticeResult("analysis_error", "This recording could not be analysed. Try WAV, MP3, M4A, or record directly in the browser."),
        lyrics: null,
      })
    } finally {
      if (context) await context.close().catch(() => undefined)
      setWorking(false)
    }
  }

  async function toggleRecording() {
    if (recording) { recorder.current?.stop(); return }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setResult({
        melody: unavailablePracticeResult("analysis_error", "Recording is not supported in this browser. Choose an audio file instead."),
        lyrics: null,
      })
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setResult({
        melody: unavailablePracticeResult("analysis_error", "Microphone access was not available. Allow access in your browser, or choose an audio file instead."),
        lyrics: null,
      })
      return
    }
    heardTranscript.current = ""
    speechStop.current?.()
    if (lyricsSupported) {
      const capture = startSpeechCapture((transcript) => {
        heardTranscript.current = transcript
      })
      speechStop.current = capture.supported ? capture.stop : null
    }
    chunks.current = []
    const next = new MediaRecorder(stream)
    next.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data) }
    next.onstop = () => {
      setRecording(false)
      speechStop.current?.()
      speechStop.current = null
      if (recordingTimer.current) window.clearInterval(recordingTimer.current)
      recordingTimer.current = null
      stream.getTracks().forEach((track) => track.stop())
      const blob = new Blob(chunks.current, { type: next.mimeType })
      if (!blob.size) {
        setResult({
          melody: unavailablePracticeResult("insufficient_audio", "No audible recording was captured. Check the microphone and try again."),
          lyrics: null,
        })
        return
      }
      void analyze(blob, heardTranscript.current)
    }
    recorder.current = next
    next.start()
    setRecording(true)
    setRecordingSeconds(0)
    recordingTimer.current = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000)
    window.setTimeout(() => { if (next.state === "recording") next.stop() }, 60_000)
  }

  return (
    <section className="mt-6 rounded-2xl border border-navy-900/10 bg-navy-950 p-5 text-white">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-300">Private practice coach</p>
      <h2 className="mt-2 font-serif text-3xl">Sing, listen, improve</h2>
      <p className="mt-2 text-sm leading-6 text-navy-100">
        Record or choose a short rendition. Melody is compared with the song notation on this device
        {lyricsSupported ? " and your spoken words are checked against the lyric line." : "."}
        {" "}Your recording is not uploaded or stored.
      </p>
      {!notation ? <p className="mt-4 rounded-xl bg-white/10 p-4 text-sm text-navy-100">A notation reference is needed before the coach can compare this song responsibly.</p> : <>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={() => void toggleRecording()} disabled={working} className={`rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60 ${recording ? "bg-red-500" : "bg-gold-500 text-navy-950"}`}>{recording ? `■ Stop and analyse · ${formatTime(recordingSeconds)}` : "● Record practice"}</button>
          <label className={`rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold ${working || recording ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-white/10"}`}>Choose audio file<input type="file" accept="audio/*,.mp3,.m4a,.wav,.webm,.ogg" disabled={working || recording} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (file.type && !file.type.startsWith("audio/")) { setResult({ melody: unavailablePracticeResult("analysis_error", "Choose an audio file containing your Prabhat Samgiita practice."), lyrics: null }); return } void analyze(file, ""); event.target.value = "" }} /></label>
        </div>
        {recording ? <p role="status" className="mt-4 text-sm text-gold-200">{lyricsSupported ? "Recording now. Sing one clear lyric line (10–30 seconds), then choose Stop and analyse." : "Recording now. Sing a clear 10 to 30 second phrase, then choose Stop and analyse."}</p> : null}
        {working ? <div role="status" className="mt-5"><LoadingIndicator label={lyricsSupported ? "Analysing melody and lyrics on this device" : "Analysing melody on this device"} /><p className="mt-2 text-xs text-navy-100">This normally takes a few seconds. Your audio remains private.</p></div> : null}
        {result ? <AnalysisPanel result={result} notation={notation} lyricsSupported={lyricsSupported} /> : null}
      </>}
    </section>
  )
}

function AnalysisPanel({
  result,
  notation,
  lyricsSupported,
}: {
  result: CoachAnalysis
  notation: TransposedNotation
  lyricsSupported: boolean
}) {
  const { melody, lyrics } = result

  return (
    <div aria-live="polite" className="mt-5 space-y-4 rounded-2xl bg-white p-5 text-navy-950">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700">Analysis complete</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ScoreCard
          label="Melody alignment"
          score={melody.score}
          detail={melody.score === null ? "more pitch evidence needed" : melody.isLikelyMatch ? "close to notation" : "keep practising melody"}
          note={melody.score !== null ? (notation.verification_status.includes("verified") ? "Compared with reviewed notation." : "Experimental similarity against a practice draft.") : null}
        />
        <ScoreCard
          label="Lyrics alignment"
          score={lyrics?.score ?? null}
          detail={lyrics?.score === null
            ? (lyricsSupported ? "sing words while recording live" : "available during live recording")
            : `${lyrics?.matchedWords ?? 0}/${lyrics?.expectedWords ?? 0} words matched`}
          note={lyrics?.bestLine ? `Closest line: ${lyrics.bestLine}` : null}
        />
      </div>
      {lyrics?.heardTranscript ? <p className="rounded-xl bg-ivory-50 p-3 text-sm leading-6 text-stone-700"><span className="font-semibold text-navy-950">Heard:</span> {lyrics.heardTranscript}</p> : null}
      <div className="space-y-2">
        {[...melody.suggestions, ...(lyrics?.suggestions ?? [])].filter((value, index, items) => items.indexOf(value) === index).map((suggestion) => (
          <p key={suggestion} className="rounded-xl bg-gold-50 p-3 text-sm leading-6">{suggestion}</p>
        ))}
      </div>
    </div>
  )
}

function ScoreCard({
  label,
  score,
  detail,
  note,
}: {
  label: string
  score: number | null
  detail: string
  note: string | null
}) {
  return (
    <div className="rounded-2xl border border-navy-900/10 bg-ivory-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700">{label}</p>
      <div className="mt-2 flex items-end gap-3">
        {score === null ? <span className="font-serif text-2xl font-bold">—</span> : <span className="font-serif text-5xl font-bold">{score}%</span>}
        <span className="pb-1 text-sm text-stone-500">{detail}</span>
      </div>
      {note ? <p className="mt-2 text-xs leading-5 text-stone-500">{note}</p> : null}
    </div>
  )
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}
