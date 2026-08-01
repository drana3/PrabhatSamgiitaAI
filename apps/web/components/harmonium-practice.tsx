"use client"

import { useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import { fetchNotation } from "@/lib/api"
import type { TransposedNotation } from "@/lib/api"

const tonics = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

export function HarmoniumPractice({ songNumber, initialNotation, sourceUrl, sourceStatus }: { songNumber: number; initialNotation: TransposedNotation | null; sourceUrl?: string | null; sourceStatus?: string | null }) {
  const [notation, setNotation] = useState(initialNotation)
  const [tonic, setTonic] = useState(initialNotation?.target_scale || "C")
  const [system, setSystem] = useState<"sargam" | "keys">("sargam")
  const [loading, setLoading] = useState(false)

  async function changeTonic(value: string) {
    setTonic(value)
    if (!initialNotation) return
    setLoading(true)
    const next = await fetchNotation(songNumber, value)
    if (next) setNotation(next)
    setLoading(false)
  }

  function hearLine(lineIndex: number) {
    if (!notation || typeof window === "undefined") return
    const notes = notation.notation.lines[lineIndex]?.measures.flatMap((measure) => measure.beats.flatMap((beat) => beat.notes.map((note) => note.western).filter(Boolean))) || []
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    notes.forEach((note, index) => {
      if (!note) return
      const match = note.match(/^([A-G])(#?)(-?\d+)$/)
      if (!match) return
      const semitones: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
      const midi = (Number(match[3]) + 1) * 12 + semitones[match[1]] + (match[2] ? 1 : 0)
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const start = context.currentTime + index * 0.55
      oscillator.type = "sine"
      oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.5)
    })
  }

  return (
    <section id="notation" className="scroll-mt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Learn on harmonium</p><h2 className="mt-2 font-serif text-3xl text-navy-950">Simple practice notation</h2><p className="mt-2 text-sm text-stone-600">Choose where Sa feels comfortable, then practise one lyric line at a time.</p></div>
        {notation ? <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${notation.verification_status.includes("verified") ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{notation.verification_status.includes("verified") ? "Verified notation" : "Practice draft"}</span> : null}
      </div>

      {notation ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-navy-900/10 bg-gold-50 p-3">
            <label className="flex items-center gap-2 text-xs font-bold text-navy-950">Your Sa<select value={tonic} onChange={(event) => void changeTonic(event.target.value)} className="rounded-lg border border-gold-500/40 bg-white px-3 py-2">{tonics.map((value) => <option key={value}>{value}</option>)}</select></label>
            <div className="flex rounded-lg border border-navy-900/10 bg-white p-1"><button type="button" onClick={() => setSystem("sargam")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${system === "sargam" ? "bg-navy-950 text-white" : "text-navy-950"}`}>Sargam</button><button type="button" onClick={() => setSystem("keys")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${system === "keys" ? "bg-navy-950 text-white" : "text-navy-950"}`}>Keyboard keys</button></div>
            {loading ? <LoadingIndicator label="Changing Sa" compact /> : <span className="ml-auto text-xs text-stone-600">Sa = {tonic}</span>}
          </div>
          <div className="mt-4 space-y-4">
            {notation.notation.lines.map((line, lineIndex) => (
              <article key={line.line_number} className="rounded-2xl border border-navy-900/10 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold leading-7 text-navy-950">{line.lyrics}</p>{line.transliteration ? <p className="text-xs text-stone-500">{line.transliteration}</p> : null}</div><button type="button" onClick={() => hearLine(lineIndex)} className="soft-chip shrink-0">▶ Hear slowly</button></div>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                  {line.measures.flatMap((measure) => measure.beats).map((beat, beatIndex) => <div key={`${line.line_number}-${beat.beat}-${beatIndex}`} className="min-w-20 rounded-xl border border-gold-500/25 bg-ivory-50 p-3 text-center"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-stone-400">Beat {beat.beat}</p><p className="mt-2 font-serif text-xl font-bold text-navy-950">{beat.notes.map((note) => system === "sargam" ? note.sargam : note.western || note.sargam).join(" ") || "–"}</p><p className="mt-1 text-[10px] text-stone-500">{beat.notes.map((note) => note.syllable).filter(Boolean).join(" ")}</p></div>)}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-gold-500/30 bg-gold-50 p-5"><h3 className="font-serif text-xl font-semibold text-navy-950">Canonical notation source available</h3><p className="mt-2 text-sm leading-6 text-stone-600">A learner-friendly version is not published until the source has been extracted and checked. This avoids teaching an invented melody.</p>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer" className="outline-button mt-4">View original notation PDF</a> : <p className="mt-3 text-xs text-stone-500">No canonical notation source is currently listed for this song.</p>} {sourceStatus ? <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-stone-500">Source status: {sourceStatus}</p> : null}</div>
      )}
    </section>
  )
}
