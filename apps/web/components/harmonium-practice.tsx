"use client"

import { useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import { PracticeCoach } from "@/components/practice-coach"
import { fetchNotation } from "@/lib/api"
import type { TransposedNotation } from "@/lib/api"

const tonics = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const scaleSteps = [0, 2, 4, 5, 7, 9, 11, 12]
const swaras = ["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni", "Sa′"]
const devanagariSwaras = ["सा", "रे", "ग", "म", "प", "ध", "नि", "सां"]
const beginnerAlankar = "Sa Re Ga Re · Re Ga Ma Ga · Ga Ma Pa Ma · Ma Pa Dha Pa · Pa Dha Ni Dha · Dha Ni Sa′ Ni"
const beginnerAlankarDescending = "Sa′ Ni Dha Ni · Ni Dha Pa Dha · Dha Pa Ma Pa · Pa Ma Ga Ma · Ma Ga Re Ga · Ga Re Sa Re"

function harmoniumKeys(tonic: string) {
  const start = Math.max(tonics.indexOf(tonic), 0)
  return scaleSteps.map((step) => tonics[(start + step) % tonics.length])
}

export function HarmoniumPractice({ songNumber, initialNotation, sourceUrl, sourceStatus }: { songNumber: number; initialNotation: TransposedNotation | null; sourceUrl?: string | null; sourceStatus?: string | null }) {
  const [notation, setNotation] = useState(initialNotation)
  const [tonic, setTonic] = useState(initialNotation?.target_scale || "C")
  const [system, setSystem] = useState<"guide" | "keys" | "sargam">("sargam")
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
    <details id="notation" className="group scroll-mt-28 rounded-2xl border border-gold-500/30 bg-gold-50/50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 marker:content-none sm:p-6">
        <div><p className="eyebrow">Optional learning studio</p><h2 className="mt-2 font-serif text-3xl text-navy-950">Practise on harmonium</h2><p className="mt-2 text-sm text-stone-600">Open the learner view for Sargam, keyboard keys, and slow line-by-line practice.</p></div>
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-950 text-xl text-white transition group-open:rotate-45">+</span>
      </summary>

      {notation ? (
        <div className="border-t border-gold-500/20 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-600">Choose where Sa feels comfortable, then practise one lyric line at a time.</p>
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${notation.verification_status.includes("verified") ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{notation.verification_status.includes("verified") ? "Verified notation" : "Practice draft"}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-navy-900/10 bg-gold-50 p-3">
            <label className="flex items-center gap-2 text-xs font-bold text-navy-950">Your Sa<select value={tonic} onChange={(event) => void changeTonic(event.target.value)} className="rounded-lg border border-gold-500/40 bg-white px-3 py-2">{tonics.map((value) => <option key={value}>{value}</option>)}</select></label>
            <div className="flex flex-wrap rounded-lg border border-navy-900/10 bg-white p-1"><ModeButton active={system === "sargam"} onClick={() => setSystem("sargam")}>Line Sargam</ModeButton><ModeButton active={system === "keys"} onClick={() => setSystem("keys")}>Keyboard keys</ModeButton><ModeButton active={system === "guide"} onClick={() => setSystem("guide")}>Warm-up guide</ModeButton></div>
            {loading ? <LoadingIndicator label="Changing Sa" compact /> : <span className="ml-auto text-xs text-stone-600">Sa = {tonic}</span>}
          </div>
          {system === "guide" ? <SargamGuide tonic={tonic} /> : <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-gold-500/25 bg-white p-4 sm:p-5"><p className="eyebrow">Song melody</p><h3 className="mt-2 font-serif text-2xl text-navy-950">Lyric-by-lyric {system === "sargam" ? "Sargam" : "harmonium keys"}</h3><p className="mt-2 text-sm leading-6 text-stone-600">Each phrase below is paired with the available notation for this Prabhat Samgiita. Use “Hear slowly” to practise one line at a time.</p></div>
            {notation.notation.lines.map((line, lineIndex) => (
              <article key={line.line_number} className="rounded-2xl border border-navy-900/10 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold leading-7 text-navy-950">{line.lyrics}</p>{line.transliteration ? <p className="text-xs text-stone-500">{line.transliteration}</p> : null}</div><button type="button" onClick={() => hearLine(lineIndex)} className="soft-chip shrink-0">▶ Hear slowly</button></div>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                  {line.measures.flatMap((measure) => measure.beats).map((beat, beatIndex) => <div key={`${line.line_number}-${beat.beat}-${beatIndex}`} className="min-w-20 rounded-xl border border-gold-500/25 bg-ivory-50 p-3 text-center"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-stone-400">Beat {beat.beat}</p><p className="mt-2 font-serif text-xl font-bold text-navy-950">{beat.notes.map((note) => system === "sargam" ? note.sargam : note.western || note.sargam).join(" ") || "–"}</p><p className="mt-1 text-[10px] text-stone-500">{beat.notes.map((note) => note.syllable).filter(Boolean).join(" ")}</p></div>)}
                </div>
              </article>
            ))}
          </div>}
          <PracticeCoach notation={notation} />
        </div>
      ) : (
        <div className="border-t border-gold-500/20 p-5 sm:p-6"><h3 className="font-serif text-xl font-semibold text-navy-950">Canonical notation source available</h3><p className="mt-2 text-sm leading-6 text-stone-600">A learner-friendly version is not published until the source has been extracted and checked. This avoids teaching an invented melody.</p>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer" className="outline-button mt-4">View original notation PDF</a> : null} {sourceStatus ? <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-stone-500">Source status: {sourceStatus}</p> : null}</div>
      )}
    </details>
  )
}

function ModeButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${active ? "bg-navy-950 text-white" : "text-navy-950"}`}>{children}</button>
}

function SargamGuide({ tonic }: { tonic: string }) {
  const keys = harmoniumKeys(tonic)
  return <section className="mt-4 rounded-2xl bg-navy-950 p-5 text-white sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-300">Optional warm-up</p><h3 className="mt-2 font-serif text-2xl">Sargam warm-up guide</h3></div><p className="text-xs text-navy-100">Current Sa: <strong className="text-white">{tonic}</strong></p></div>
    <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-8">{swaras.map((swara, index) => <div key={swara} className="rounded-xl border border-white/15 bg-white/8 p-3 text-center"><p className="text-2xl font-semibold text-gold-200" lang="hi">{devanagariSwaras[index]}</p><p className="mt-1 font-serif text-sm font-semibold text-white">{swara}</p><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-navy-100">Key {keys[index]}</p></div>)}</div>
    <div className="mt-5 rounded-2xl border border-white/15 bg-white/8 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-300">On harmonium keys</p><h4 className="mt-1 font-serif text-xl text-white">Visual key guide</h4></div><p className="text-xs text-navy-100">Press from left to right for aroha</p></div>
      <div className="mt-4 flex min-w-0 overflow-x-auto rounded-xl border-4 border-gold-900/55 bg-gold-900/55 p-1" role="img" aria-label={`Harmonium key guide with Sa on ${tonic}`}>
        {keys.map((key, index) => <div key={`${key}-${index}`} className="relative flex h-28 min-w-14 flex-1 flex-col items-center justify-end border-r border-stone-300 bg-ivory-50 px-1 pb-2 text-navy-950 last:border-r-0 sm:min-w-16"><span className="absolute inset-x-1 top-2 rounded-md bg-navy-950 px-1 py-2 text-center text-[10px] font-bold text-white">{key}</span><span className="text-lg font-semibold" lang="hi">{devanagariSwaras[index]}</span><span className="text-[10px] font-bold uppercase tracking-wide text-stone-500">{swaras[index]}</span></div>)}
      </div>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><GuideRow label="Aroha · ascending" value="Sa Re Ga Ma Pa Dha Ni Sa′" /><GuideRow label="Avaroha · descending" value="Sa′ Ni Dha Pa Ma Ga Re Sa" /></div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2"><GuideRow label="Beginner alankar · ascending" value={beginnerAlankar} /><GuideRow label="Beginner alankar · descending" value={beginnerAlankarDescending} /></div>
    <div className="mt-4 grid gap-3 text-xs leading-6 text-navy-100 sm:grid-cols-2">
      <div className="rounded-xl bg-white/8 p-4"><strong className="text-white">Key points:</strong> Sa and Pa are stable swaras. Re, Ga, Dha, and Ni can be komal; Ma can be tivra. Begin slowly and keep each note even.</div>
      <div className="rounded-xl bg-white/8 p-4"><strong className="text-white">Reading marks:</strong> a lower dot means the lower octave, an upper dot or prime means the upper octave, a flat or underlined swara is komal, and a raised Ma is tivra.</div>
    </div>
    <p className="mt-4 text-[11px] leading-5 text-navy-200">The key map and alankar are general learning aids. Song cards below preserve the available source notation rather than inventing missing notes or a raga-specific pakad.</p>
  </section>
}

function GuideRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/15 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold-300">{label}</p><p className="mt-2 font-serif text-lg tracking-wide text-white">{value}</p></div>
}
