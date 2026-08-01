"use client"

import { useEffect, useRef, useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import type { TransposedNotation } from "@/lib/api"
import { comparePitchSequence, expectedMidi, extractPitchTrack, unavailablePracticeResult } from "@/lib/practice-analysis"
import type { PracticeResult } from "@/lib/practice-analysis"

export function PracticeCoach({ notation }: { notation: TransposedNotation | null }) {
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState<PracticeResult | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const recordingTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (recordingTimer.current) window.clearInterval(recordingTimer.current)
    if (recorder.current?.state === "recording") recorder.current.stop()
  }, [])

  async function analyze(blob: Blob) {
    if (!notation) return
    if (blob.size > 20 * 1024 * 1024) {
      setResult(unavailablePracticeResult("analysis_error", "Choose an audio recording smaller than 20 MB."))
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
        setResult(unavailablePracticeResult("analysis_error", "Choose a focused practice excerpt of one minute or less."))
      } else {
        setResult(comparePitchSequence(extractPitchTrack(buffer.getChannelData(0), buffer.sampleRate), expectedMidi(notation)))
      }
    } catch {
      setResult(unavailablePracticeResult("analysis_error", "This recording could not be analysed. Try WAV, MP3, M4A, or record directly in the browser."))
    } finally {
      if (context) await context.close().catch(() => undefined)
      setWorking(false)
    }
  }

  async function toggleRecording() {
    if (recording) { recorder.current?.stop(); return }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setResult(unavailablePracticeResult("analysis_error", "Recording is not supported in this browser. Choose an audio file instead."))
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setResult(unavailablePracticeResult("analysis_error", "Microphone access was not available. Allow access in your browser, or choose an audio file instead."))
      return
    }
    chunks.current = []
    const next = new MediaRecorder(stream)
    next.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data) }
    next.onstop = () => {
      setRecording(false)
      if (recordingTimer.current) window.clearInterval(recordingTimer.current)
      recordingTimer.current = null
      stream.getTracks().forEach((track) => track.stop())
      const blob = new Blob(chunks.current, { type: next.mimeType })
      if (!blob.size) {
        setResult(unavailablePracticeResult("insufficient_audio", "No audible recording was captured. Check the microphone and try again."))
        return
      }
      void analyze(blob)
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
      <p className="mt-2 text-sm leading-6 text-navy-100">Record or choose a short rendition. Pitch analysis happens on this device and the recording is not uploaded or stored.</p>
      {!notation ? <p className="mt-4 rounded-xl bg-white/10 p-4 text-sm text-navy-100">A notation reference is needed before the coach can compare this song responsibly.</p> : <>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={() => void toggleRecording()} disabled={working} className={`rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60 ${recording ? "bg-red-500" : "bg-gold-500 text-navy-950"}`}>{recording ? `■ Stop and analyse · ${formatTime(recordingSeconds)}` : "● Record practice"}</button>
          <label className={`rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold ${working || recording ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-white/10"}`}>Choose audio file<input type="file" accept="audio/*,.mp3,.m4a,.wav,.webm,.ogg" disabled={working || recording} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (file.type && !file.type.startsWith("audio/")) { setResult(unavailablePracticeResult("analysis_error", "Choose an audio file containing your Prabhat Samgiita practice.")); return } void analyze(file); event.target.value = "" }} /></label>
        </div>
        {recording ? <p role="status" className="mt-4 text-sm text-gold-200">Recording now. Sing a clear 10 to 30 second phrase, then choose Stop and analyse.</p> : null}
        {working ? <div role="status" className="mt-5"><LoadingIndicator label="Analysing melody on this device" /><p className="mt-2 text-xs text-navy-100">This normally takes a few seconds. Your audio remains private.</p></div> : null}
        {result ? <div aria-live="polite" className="mt-5 rounded-2xl bg-white p-5 text-navy-950"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700">Analysis complete</p><div className="mt-2 flex items-end gap-3">{result.score === null ? <span className="font-serif text-3xl font-bold">Assessment unavailable</span> : <span className="font-serif text-5xl font-bold">{result.score}%</span>}<span className="pb-1 text-sm text-stone-500">{result.score === null ? "more audio evidence needed" : result.isLikelyMatch ? "melody similarity" : "keep practising"}</span></div>{result.score !== null ? <p className="mt-2 text-xs text-stone-500">{notation.verification_status.includes("verified") ? "Compared with reviewed notation." : "Experimental similarity against a practice draft; verify with the source notation."}</p> : null}<div className="mt-4 space-y-2">{result.suggestions.map((suggestion) => <p key={suggestion} className="rounded-xl bg-gold-50 p-3 text-sm leading-6">{suggestion}</p>)}</div></div> : null}
      </>}
    </section>
  )
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}
