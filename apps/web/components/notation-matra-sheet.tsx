"use client"

import {
  buildNotationSheetLine,
  formatTalaHeader,
  harmoniumSampleUrl,
  reedWavDataUri,
  sheetPlayEvents,
  type SheetCell,
  type SheetTala,
} from "@prabhat/core"
import type { NotationLine } from "@/lib/api"

type Props = {
  songNumber: number
  line: NotationLine
  lineIndex: number
  tala?: SheetTala | null
  tempoBpm?: number | null
  onPlay?: () => void
  playing?: boolean
  expertVerified?: boolean
}

function scheduleOscillator(
  context: AudioContext,
  frequencyHz: number,
  start: number,
  durationSec: number,
) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const lowpass = context.createBiquadFilter()
  lowpass.type = "lowpass"
  lowpass.frequency.value = 3200
  lowpass.Q.value = 0.7
  oscillator.type = "triangle"
  oscillator.frequency.value = frequencyHz
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.08, start + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec)
  oscillator.connect(lowpass).connect(gain).connect(context.destination)
  oscillator.start(start)
  oscillator.stop(start + durationSec + 0.02)
}

function scheduleBuffer(
  context: AudioContext,
  buffer: AudioBuffer,
  start: number,
  durationSec: number,
) {
  const source = context.createBufferSource()
  const gain = context.createGain()
  const lowpass = context.createBiquadFilter()
  lowpass.type = "lowpass"
  lowpass.frequency.value = 2800
  lowpass.Q.value = 0.5
  source.buffer = buffer
  const playDuration = Math.min(durationSec, buffer.duration)
  // Samples already carry attack/release — only trim level and add a short fade-out.
  gain.gain.setValueAtTime(0.5, start)
  gain.gain.setValueAtTime(0.5, start + Math.max(0, playDuration - 0.04))
  gain.gain.linearRampToValueAtTime(0.001, start + playDuration)
  source.connect(lowpass).connect(gain).connect(context.destination)
  source.start(start, 0, playDuration)
}

async function loadSampleBuffer(context: AudioContext, western: string): Promise<AudioBuffer | null> {
  const url = harmoniumSampleUrl(western)
  if (!url) return null
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return await context.decodeAudioData(await response.arrayBuffer())
  } catch {
    return null
  }
}

async function playCellsInBrowser(cells: SheetCell[], tempoBpm?: number | null) {
  if (typeof window === "undefined" || !cells.length) return
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return

  const context = new AudioContextClass()
  await context.resume()

  const events = sheetPlayEvents(cells, 0.55, tempoBpm)
  if (!events.length) return

  const buffers = await Promise.all(events.map((event) => loadSampleBuffer(context, event.western)))
  const baseTime = context.currentTime + 0.05

  events.forEach((event, index) => {
    const start = baseTime + event.startSec
    const buffer = buffers[index]
    if (buffer) {
      scheduleBuffer(context, buffer, start, event.durationSec)
    } else {
      const fallbackUri = reedWavDataUri(event.frequencyHz, Math.max(0.2, event.durationSec))
      void fetch(fallbackUri)
        .then((response) => response.arrayBuffer())
        .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))
        .then((decoded) => scheduleBuffer(context, decoded, start, event.durationSec))
        .catch(() => scheduleOscillator(context, event.frequencyHz, start, event.durationSec))
    }
  })
}

export function NotationMatraSheet({
  songNumber,
  line,
  lineIndex,
  tala,
  tempoBpm,
  onPlay,
  playing = false,
  expertVerified = false,
}: Props) {
  const sheet = buildNotationSheetLine(line, tala)
  if (!sheet.cells.length) return null

  const handlePlay = () => {
    void playCellsInBrowser(sheet.cells, tempoBpm)
    onPlay?.()
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-navy-900/15 bg-[#fbf7ef]">
      <div className="flex items-center justify-between gap-3 border-b border-navy-900/10 px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-navy-950">
          {formatTalaHeader(tala, songNumber)} · पंक्ति {lineIndex + 1}
          {expertVerified ? " · Expert sheet" : ""}
        </p>
        <button
          type="button"
          onClick={handlePlay}
          className="inline-flex items-center gap-1.5 rounded-full border border-gold-600/40 bg-gold-100 px-3 py-1.5 text-xs font-bold text-navy-950"
          aria-label={`Play harmonium for line ${lineIndex + 1}`}
        >
          {playing ? "… Playing" : "▶ Harmonium"}
        </button>
      </div>
      <div className="inline-flex min-w-full">
        {sheet.cells.map((cell, index) => (
          <div
            key={`${sheet.lineNumber}-${index}`}
            className={`min-w-[2.6rem] flex-1 border-navy-900/15 px-1 py-2 text-center ${
              cell.barStart && index > 0 ? "border-l-2 border-l-navy-900/40" : "border-l"
            }`}
          >
            <p className="min-h-[1.5rem] font-serif text-base font-bold text-navy-950" lang="hi">
              {cell.sargam}
            </p>
            <p className="mt-1 min-h-[1.4rem] font-serif text-sm text-navy-950" lang="hi">
              {cell.lyric}
            </p>
            <p className="mt-1 text-[10px] font-bold text-stone-600">{cell.matra}</p>
          </div>
        ))}
      </div>
      <p className="border-t border-navy-900/10 px-3 py-1.5 text-[10px] text-stone-500">
        ऊपर: सारगम · मध्य: अक्षर · नीचे: मात्रा (X = सम)
        {expertVerified ? " · reed sample bank" : ""}
      </p>
    </div>
  )
}

export function ExpertSheetImage({ songNumber }: { songNumber: number }) {
  if (songNumber !== 4961) return null
  return (
    <figure className="mt-4 overflow-hidden rounded-xl border border-navy-900/15 bg-white">
      <figcaption className="border-b border-navy-900/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-navy-950">
        Expert handwritten sheet · PS {songNumber}
      </figcaption>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/notation/expert/${songNumber}.png`}
        alt={`Expert notation scan for Prabhat Samgiita ${songNumber}`}
        className="mx-auto max-h-[28rem] w-full object-contain bg-[#f7f3ea]"
      />
    </figure>
  )
}

export { playCellsInBrowser, reedWavDataUri }
