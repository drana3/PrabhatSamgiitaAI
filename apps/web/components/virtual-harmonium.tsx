"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  HARMONIUM_TONICS,
  RAGHUPATI_RAGHAV_SONG,
  SARGAM_EXAMPLES,
  harmoniumKeyboardLayout,
  keyboardIndexForShortcut,
  keyboardIndexForWestern,
  parseSargamInput,
  sampleSongLineEvents,
  sampleSongPlayEvents,
  sargamPlayEvents,
  type HarmoniumKeyboardKey,
} from "@prabhat/core"

import { playSheetEvents, startWesternNote, stopActiveWesternNote } from "@/lib/harmonium-playback"

type Props = {
  tonic: string
  onTonicChange?: (tonic: string) => void
  compact?: boolean
}

export function VirtualHarmonium({ tonic, onTonicChange, compact = false }: Props) {
  const [typed, setTyped] = useState("")
  const [activeIndexes, setActiveIndexes] = useState<Set<number>>(new Set())
  const [playing, setPlaying] = useState(false)
  const [songLineIndex, setSongLineIndex] = useState<number | null>(null)
  const stopsRef = useRef(new Map<number, () => void>())
  const highlightTimers = useRef<number[]>([])
  const keys = useMemo(() => harmoniumKeyboardLayout(tonic), [tonic])
  const whiteKeys = useMemo(() => keys.filter((key) => !key.isBlack), [keys])
  const blackKeys = useMemo(() => keys.filter((key) => key.isBlack), [keys])
  const parsedPreview = useMemo(() => parseSargamInput(typed, tonic), [typed, tonic])
  const song = RAGHUPATI_RAGHAV_SONG

  const clearHighlights = useCallback(() => {
    highlightTimers.current.forEach((timer) => window.clearTimeout(timer))
    highlightTimers.current = []
    setSongLineIndex(null)
  }, [])

  useEffect(() => {
    return () => {
      stopsRef.current.forEach((stop) => stop())
      stopsRef.current.clear()
      stopActiveWesternNote()
      highlightTimers.current.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  const releaseKey = useCallback((index: number) => {
    const stop = stopsRef.current.get(index)
    if (!stop) return
    stop()
    stopsRef.current.delete(index)
    setActiveIndexes((current) => {
      if (!current.has(index)) return current
      const next = new Set(current)
      next.delete(index)
      return next
    })
  }, [])

  const pressKey = useCallback(async (key: HarmoniumKeyboardKey | undefined, index: number) => {
    if (!key || stopsRef.current.has(index)) return
    stopsRef.current.set(index, () => undefined)
    setActiveIndexes((current) => {
      const next = new Set(current)
      next.add(index)
      return next
    })
    const stop = await startWesternNote(key.western)
    if (!stopsRef.current.has(index)) {
      stop()
      return
    }
    stopsRef.current.set(index, stop)
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.repeat) return
      const target = event.target as HTMLElement | null
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return

      const index = keyboardIndexForShortcut(event.key)
      if (index >= 0) {
        event.preventDefault()
        void pressKey(keys[index], index)
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      const index = keyboardIndexForShortcut(event.key)
      if (index >= 0) releaseKey(index)
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [keys, pressKey, releaseKey])

  function keyPointerHandlers(key: HarmoniumKeyboardKey, index: number) {
    return {
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        void pressKey(key, index)
      },
      onPointerUp: () => releaseKey(index),
      onPointerCancel: () => releaseKey(index),
      onPointerLeave: (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.buttons === 0) releaseKey(index)
      },
    }
  }

  async function playTyped() {
    if (!typed.trim() || playing) return
    setPlaying(true)
    clearHighlights()
    try {
      await playSheetEvents(sargamPlayEvents(tonic, typed))
    } finally {
      setPlaying(false)
    }
  }

  async function playSampleSong() {
    if (playing) return
    setPlaying(true)
    clearHighlights()
    const events = sampleSongPlayEvents(tonic, song)
    const lines = sampleSongLineEvents(tonic, song)
    for (const [lineIndex, line] of lines.entries()) {
      highlightTimers.current.push(
        window.setTimeout(() => setSongLineIndex(lineIndex), Math.round(line.startSec * 1000)),
      )
    }
    for (const event of events) {
      highlightTimers.current.push(
        window.setTimeout(() => {
          const index = keyboardIndexForWestern(keys, event.western)
          setActiveIndexes(index >= 0 ? new Set([index]) : new Set())
        }, Math.round(event.startSec * 1000)),
      )
    }
    try {
      await playSheetEvents(events)
    } finally {
      setPlaying(false)
      setActiveIndexes(new Set())
      setSongLineIndex(null)
    }
  }

  const activeLine = songLineIndex != null ? song.lines[songLineIndex] : null

  return (
    <section className="rounded-2xl border border-amber-900/40 bg-[#3b2416] p-4 text-white sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-300">Classic harmonium</p>
          <h3 className="mt-1 font-serif text-2xl text-white">Two-octave keyboard</h3>
          {!compact ? (
            <p className="mt-1 text-xs text-amber-100/80">
              Hold keys like a real harmonium — they keep sounding until you lift. Play chords. White: E R T Y U I O P · Black: 4 5 7 8 9 · Gold dot is Sa
            </p>
          ) : null}
        </div>
        {onTonicChange ? (
          <label className="flex items-center gap-2 text-xs font-bold text-amber-100">
            Sa
            <select
              value={tonic}
              onChange={(event) => onTonicChange(event.target.value)}
              className="rounded-lg border border-white/20 bg-white px-2 py-1.5 text-navy-950"
            >
              {HARMONIUM_TONICS.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-xs text-amber-100">
            Sa = <strong className="text-white">{tonic}</strong>
          </p>
        )}
      </div>

      <div
        className="relative mt-4 overflow-x-auto rounded-xl border-4 border-[#2a160c] bg-[#2a160c] p-2"
        role="group"
        aria-label="Virtual harmonium keyboard"
      >
        <div className="relative h-40 min-w-[36rem]">
          <div className="flex h-full">
            {whiteKeys.map((key) => {
              const index = keys.indexOf(key)
              const active = activeIndexes.has(index)
              return (
                <button
                  key={key.western}
                  type="button"
                  className={`relative flex flex-1 flex-col items-center justify-end border-r border-stone-400 pb-2 last:border-r-0 ${
                    active ? "bg-gold-200" : key.isSa ? "bg-ivory-50" : "bg-[#f4efe4] hover:bg-gold-50"
                  }`}
                  aria-pressed={active}
                  aria-label={`${key.latin} ${key.keyLabel}`}
                  {...keyPointerHandlers(key, index)}
                >
                  {key.isSa ? (
                    <span className="absolute top-2 h-2.5 w-2.5 rounded-full bg-gold-500" aria-hidden="true" />
                  ) : null}
                  <span className="text-[10px] font-bold uppercase text-stone-500">{key.shortcut}</span>
                  <span className="text-sm font-semibold text-navy-950" lang="hi">
                    {key.devanagari}
                  </span>
                  <span className="text-[9px] font-bold text-stone-600">{key.latin}</span>
                </button>
              )
            })}
          </div>
          {blackKeys.map((key) => {
            const index = keys.indexOf(key)
            const active = activeIndexes.has(index)
            return (
              <button
                key={key.western}
                type="button"
                className={`absolute top-2 z-10 flex h-[58%] w-[4.6%] -translate-x-1/2 flex-col items-center justify-end rounded-b-md border border-black/70 pb-1.5 text-white ${
                  active ? "bg-gold-600" : "bg-navy-950 hover:bg-navy-800"
                }`}
                style={{ left: `${key.blackLeftPercent}%` }}
                aria-pressed={active}
                aria-label={`${key.latin} ${key.keyLabel}`}
                {...keyPointerHandlers(key, index)}
              >
                <span className="text-[8px] font-bold text-gold-300">{key.shortcut}</span>
                <span className="text-[10px]" lang="hi">
                  {key.devanagari}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/15 bg-black/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-300">Sample song</p>
            <h4 className="font-serif text-xl">{song.title}</h4>
            <p className="text-sm text-amber-100/80" lang="hi">
              {song.titleHi}
            </p>
            <p className="mt-1 text-xs text-amber-100/70">
              Set Sa, then each sargam syllable lights the matching key — white = shuddha, black = komal/tivra.
            </p>
            {song.sourceUrl ? (
              <a
                href={song.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs font-semibold text-gold-300 underline"
              >
                {song.sourceLabel ?? "Lesson"}
              </a>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void playSampleSong()}
            disabled={playing}
            className="rounded-xl bg-gold-300 px-4 py-2.5 text-sm font-bold text-navy-950 disabled:opacity-50"
          >
            {playing && songLineIndex != null ? "Playing…" : "▶ Play on keys"}
          </button>
        </div>
        <ol className="mt-3 space-y-2 text-sm">
          {song.lines.map((line, index) => (
            <li
              key={line.lyric}
              className={`rounded-xl px-3 py-2 ${
                songLineIndex === index ? "bg-gold-300/20 text-white" : "text-amber-100/80"
              }`}
            >
              <p className="font-semibold">{line.lyric}</p>
              <p className="text-xs" lang="hi">
                {line.lyricHi}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-gold-200">{line.sargam}</p>
            </li>
          ))}
        </ol>
        {activeLine ? (
          <p className="mt-2 text-xs text-gold-200">Now: {activeLine.lyric}</p>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-white/15 bg-white/8 p-4">
        <label className="block text-[10px] font-bold uppercase tracking-[0.16em] text-gold-300" htmlFor="sargam-type-input">
          Type sargam
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="sargam-type-input"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Sa Re Ga Ma Pa Dha Ni Sa′  or  सा रे ग म प ध नि सां"
            className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white px-3 py-2.5 text-sm text-navy-950"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void playTyped()
              }
            }}
          />
          <button
            type="button"
            onClick={() => void playTyped()}
            disabled={!typed.trim() || playing}
            className="rounded-xl bg-gold-300 px-4 py-2.5 text-sm font-bold text-navy-950 disabled:opacity-50"
          >
            {playing ? "Playing…" : "▶ Play"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SARGAM_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setTyped(example)}
              className="rounded-full border border-white/20 px-3 py-1 text-xs text-navy-100 hover:bg-white/10"
            >
              {example}
            </button>
          ))}
        </div>
        {parsedPreview.length ? (
          <p className="mt-3 text-xs text-navy-100">
            {parsedPreview.length} swara{parsedPreview.length === 1 ? "" : "s"} ready ·{" "}
            {parsedPreview.map((item) => item.western).join(" · ")}
          </p>
        ) : typed.trim() ? (
          <p className="mt-3 text-xs text-amber-200">Could not read swaras — try Sa Re Ga Ma or सा रे ग म</p>
        ) : null}
      </div>
    </section>
  )
}
