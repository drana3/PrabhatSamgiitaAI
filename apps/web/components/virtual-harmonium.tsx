"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  HARMONIUM_TONICS,
  SARGAM_EXAMPLES,
  harmoniumKeyboardLayout,
  keyboardIndexForShortcut,
  parseSargamInput,
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
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)
  const keys = useMemo(() => harmoniumKeyboardLayout(tonic), [tonic])
  const parsedPreview = useMemo(() => parseSargamInput(typed, tonic), [typed, tonic])

  useEffect(() => {
    return () => {
      stopRef.current?.()
      stopActiveWesternNote()
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
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
  }, [keys, releaseKey])

  async function pressKey(key: HarmoniumKeyboardKey | undefined, index: number) {
    if (!key) return
    setActiveIndex(index)
    stopRef.current?.()
    stopRef.current = await startWesternNote(key.western)
  }

  const releaseKey = useCallback((index: number) => {
    setActiveIndex((current) => {
      if (current !== index) return current
      stopRef.current?.()
      stopRef.current = null
      stopActiveWesternNote()
      return null
    })
  }, [])

  async function playTyped() {
    if (!typed.trim() || playing) return
    setPlaying(true)
    try {
      await playSheetEvents(sargamPlayEvents(tonic, typed))
    } finally {
      setPlaying(false)
    }
  }

  return (
    <section className="rounded-2xl border border-navy-900/10 bg-navy-950 p-4 text-white sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-300">Live harmonium</p>
          <h3 className="mt-1 font-serif text-2xl text-white">Tap keys or type sargam</h3>
          {!compact ? (
            <p className="mt-1 text-xs text-navy-100">
              Keyboard: Z X C V B N M , · Hold a key to sustain · Type Sa Re Ga Ma…
            </p>
          ) : null}
        </div>
        {onTonicChange ? (
          <label className="flex items-center gap-2 text-xs font-bold text-navy-100">
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
          <p className="text-xs text-navy-100">
            Sa = <strong className="text-white">{tonic}</strong>
          </p>
        )}
      </div>

      <div
        className="mt-4 flex min-w-0 overflow-x-auto rounded-xl border-4 border-gold-900/55 bg-gold-900/55 p-1"
        role="group"
        aria-label="Virtual harmonium keyboard"
      >
        {keys.map((key, index) => {
          const active = activeIndex === index
          return (
            <button
              key={`${key.western}-${index}`}
              type="button"
              className={`relative flex h-32 min-w-[3.4rem] flex-1 flex-col items-center justify-end border-r border-stone-300 px-1 pb-2 text-navy-950 transition last:border-r-0 sm:min-w-16 ${
                active ? "translate-y-1 bg-gold-200 shadow-inner" : "bg-ivory-50 hover:bg-gold-50"
              }`}
              aria-pressed={active}
              aria-label={`${key.latin} ${key.keyLabel}`}
              onPointerDown={(event) => {
                event.preventDefault()
                event.currentTarget.setPointerCapture(event.pointerId)
                void pressKey(key, index)
              }}
              onPointerUp={() => releaseKey(index)}
              onPointerCancel={() => releaseKey(index)}
              onPointerLeave={(event) => {
                if (event.buttons === 0) releaseKey(index)
              }}
            >
              <span className="absolute inset-x-1 top-2 rounded-md bg-navy-950 px-1 py-1.5 text-center text-[10px] font-bold text-white">
                {key.keyLabel}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-stone-500">{key.shortcut}</span>
              <span className="text-lg font-semibold" lang="hi">
                {key.devanagari}
              </span>
              <span className="text-[10px] font-bold text-stone-600">{key.latin}</span>
            </button>
          )
        })}
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
