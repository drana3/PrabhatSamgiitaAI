"use client"

import { useRef, useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import type { TransposedNotation } from "@/lib/api"
import { comparePitchSequence, expectedMidi } from "@/lib/practice-analysis"
import type { PracticeResult } from "@/lib/practice-analysis"

export function PracticeCoach({ notation }: { notation: TransposedNotation | null }) {
  const [recording, setRecording] = useState(false)
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState<PracticeResult | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  async function analyze(blob: Blob) {
    if (!notation) return
    if (blob.size > 20 * 1024 * 1024) {
      setResult({ isLikelyMatch: false, score: 0, matchedNotes: 0, expectedNotes: 0, averageCents: 0, suggestions: ["Choose an audio recording smaller than 20 MB."] })
      return
    }
    setWorking(true)
    setResult(null)
    try {
      const context = new AudioContext()
      const buffer = await context.decodeAudioData(await blob.arrayBuffer())
      const observed = extractPitchTrack(buffer)
      if (buffer.duration > 120) {
        setResult({ isLikelyMatch: false, score: 0, matchedNotes: 0, expectedNotes: 0, averageCents: 0, suggestions: ["Choose a practice excerpt of two minutes or less."] })
      } else {
        setResult(comparePitchSequence(observed, expectedMidi(notation)))
      }
      await context.close()
    } catch {
      setResult({ isLikelyMatch: false, score: 0, matchedNotes: 0, expectedNotes: 0, averageCents: 0, suggestions: ["This recording could not be analysed. Try WAV, MP3, M4A, or record directly in the browser."] })
    } finally {
      setWorking(false)
    }
  }

  async function toggleRecording() {
    if (recording) { recorder.current?.stop(); return }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setResult({ isLikelyMatch: false, score: 0, matchedNotes: 0, expectedNotes: 0, averageCents: 0, suggestions: ["Microphone access was not available. Allow access in your browser, or choose an audio file instead."] })
      return
    }
    chunks.current = []
    const next = new MediaRecorder(stream)
    next.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data) }
    next.onstop = () => {
      setRecording(false)
      stream.getTracks().forEach((track) => track.stop())
      void analyze(new Blob(chunks.current, { type: next.mimeType }))
    }
    recorder.current = next
    next.start()
    setRecording(true)
    window.setTimeout(() => { if (next.state === "recording") next.stop() }, 120_000)
  }

  return (
    <section className="mt-6 rounded-2xl border border-navy-900/10 bg-navy-950 p-5 text-white">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-300">Private practice coach</p>
      <h2 className="mt-2 font-serif text-3xl">Sing, listen, improve</h2>
      <p className="mt-2 text-sm leading-6 text-navy-100">Record or choose a short rendition. Pitch analysis happens on this device and the recording is not uploaded or stored.</p>
      {!notation ? <p className="mt-4 rounded-xl bg-white/10 p-4 text-sm text-navy-100">A notation reference is needed before the coach can compare this song responsibly.</p> : <>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={() => void toggleRecording()} disabled={working} className={`rounded-full px-5 py-2.5 text-sm font-semibold ${recording ? "bg-red-500" : "bg-gold-500 text-navy-950"}`}>{recording ? "■ Stop and analyse" : "● Record practice"}</button>
          <label className="cursor-pointer rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold hover:bg-white/10">Upload audio<input type="file" accept="audio/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void analyze(file) }} /></label>
        </div>
        {working ? <div className="mt-5"><LoadingIndicator label="Listening to pitch and phrasing" /></div> : null}
        {result ? <div aria-live="polite" className="mt-5 rounded-2xl bg-white p-5 text-navy-950"><div className="flex items-end gap-3"><span className="font-serif text-5xl font-bold">{result.score}</span><span className="pb-1 text-sm text-stone-500">{result.isLikelyMatch ? "melody similarity" : "match not confirmed"}</span></div><p className="mt-2 text-xs text-stone-500">{notation.verification_status.includes("verified") ? "Compared with reviewed notation." : "Experimental guidance from a practice draft; verify with the source notation."}</p><div className="mt-4 space-y-2">{result.suggestions.map((suggestion) => <p key={suggestion} className="rounded-xl bg-gold-50 p-3 text-sm leading-6">{suggestion}</p>)}</div></div> : null}
      </>}
    </section>
  )
}

function extractPitchTrack(buffer: AudioBuffer) {
  const samples = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate
  const windowSize = 2048
  const hop = 1024
  const pitches: number[] = []
  for (let offset = 0; offset + windowSize < samples.length; offset += hop) {
    let rms = 0
    for (let index = 0; index < windowSize; index++) rms += samples[offset + index] ** 2
    if (Math.sqrt(rms / windowSize) < 0.02) continue
    let bestLag = 0
    let bestCorrelation = 0
    const minLag = Math.floor(sampleRate / 800)
    const maxLag = Math.min(windowSize - 1, Math.floor(sampleRate / 80))
    for (let lag = minLag; lag <= maxLag; lag++) {
      let correlation = 0
      for (let index = 0; index < windowSize - lag; index++) correlation += samples[offset + index] * samples[offset + index + lag]
      if (correlation > bestCorrelation) { bestCorrelation = correlation; bestLag = lag }
    }
    if (bestLag) pitches.push(69 + 12 * Math.log2((sampleRate / bestLag) / 440))
  }
  return pitches.filter((value, index) => index % 4 === 0)
}
