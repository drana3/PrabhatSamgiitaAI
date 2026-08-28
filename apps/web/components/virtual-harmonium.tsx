"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  BANDHU_HE_NIYE_CALO_SONG,
  HARMONIUM_BPM_DEFAULT,
  HARMONIUM_BPM_MAX,
  HARMONIUM_BPM_MIN,
  HARMONIUM_PLAY_TEMPO_ORDER,
  HARMONIUM_PLAY_TEMPOS,
  HARMONIUM_TONICS,
  HARMONIUM_VOICE_REGISTERS,
  SARGAM_EXAMPLES,
  clampHarmoniumBpm,
  harmoniumKeyboardLayout,
  keyboardIndexForShortcut,
  keyboardIndexForWestern,
  parseSargamInput,
  sampleSongLineEvents,
  sampleSongPlayEvents,
  sampleSongTiming,
  sargamPlayEvents,
  type HarmoniumKeyboardKey,
  type HarmoniumSampleSong,
  type HarmoniumVoiceRegister,
} from "@prabhat/core"

import { playSheetEvents, startWesternNote, stopActiveWesternNote, ensureHarmoniumPlayer, setHarmoniumBellows, setHarmoniumFineTune, setHarmoniumVoiceRegister, startHarmoniumDrone, stopHarmoniumDrone, pauseHarmoniumSheet, resumeHarmoniumSheet, stopHarmoniumSheet, getHarmoniumSheetSeconds, retargetHarmoniumSheet } from "@/lib/harmonium-playback"

type Props = {
  tonic: string
  onTonicChange?: (tonic: string) => void
  compact?: boolean
  song?: HarmoniumSampleSong
  keyboardOnly?: boolean
  onPressKey?: (key: HarmoniumKeyboardKey) => void
  onReleaseKey?: (key: HarmoniumKeyboardKey) => void
}

export function VirtualHarmonium({
  tonic,
  onTonicChange,
  compact = false,
  song = BANDHU_HE_NIYE_CALO_SONG,
  keyboardOnly = false,
  onPressKey,
  onReleaseKey,
}: Props) {
  const [typed, setTyped] = useState("")
  const [activeIndexes, setActiveIndexes] = useState<Set<number>>(new Set())
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [songLineIndex, setSongLineIndex] = useState<number | null>(null)
  const [ready, setReady] = useState(false)
  const [droneOn, setDroneOn] = useState(false)
  const [bellows, setBellows] = useState(0.7)
  const [fineTune, setFineTune] = useState(0)
  const [voiceRegister, setVoiceRegister] = useState<HarmoniumVoiceRegister>("male")
  const [tempoBpm, setTempoBpm] = useState(HARMONIUM_BPM_DEFAULT)
  const stopsRef = useRef(new Map<number, () => void>())
  const playbackRef = useRef<{ events: ReturnType<typeof sampleSongPlayEvents>; lines: ReturnType<typeof sampleSongLineEvents> } | null>(null)
  const scheduledBpmRef = useRef(tempoBpm)
  const keys = useMemo(() => harmoniumKeyboardLayout(tonic), [tonic])
  const whiteKeys = useMemo(() => keys.filter((key) => !key.isBlack), [keys])
  const blackKeys = useMemo(() => keys.filter((key) => key.isBlack), [keys])
  const parsedPreview = useMemo(() => parseSargamInput(typed, tonic), [typed, tonic])
  const tempoPreset = sampleSongTiming(tempoBpm)
  const isSample = song.id === BANDHU_HE_NIYE_CALO_SONG.id

  const clearHighlights = useCallback(() => {
    setSongLineIndex(null)
    setActiveIndexes(new Set())
  }, [])

  useEffect(() => {
    void ensureHarmoniumPlayer().then(setReady)
    return () => {
      stopsRef.current.forEach((stop) => stop())
      stopsRef.current.clear()
      stopHarmoniumDrone()
      stopHarmoniumSheet()
      stopActiveWesternNote()
    }
  }, [])

  useEffect(() => {
    setHarmoniumBellows(bellows)
  }, [bellows])

  useEffect(() => {
    setHarmoniumFineTune(fineTune)
  }, [fineTune])

  useEffect(() => {
    const register = HARMONIUM_VOICE_REGISTERS.find((item) => item.id === voiceRegister)
    setHarmoniumVoiceRegister(register?.semitones ?? 0)
  }, [voiceRegister])

  useEffect(() => {
    if (!playing || paused) return
    let frame = 0
    const tick = () => {
      const now = getHarmoniumSheetSeconds()
      const playback = playbackRef.current
      if (playback) {
        let lineIndex: number | null = null
        for (const [index, line] of playback.lines.entries()) {
          if (now >= line.startSec) lineIndex = index
        }
        setSongLineIndex(lineIndex)
        let activeWestern: string | null = null
        for (const event of playback.events) {
          if (now >= event.startSec && now < event.startSec + event.durationSec) {
            activeWestern = event.western
          }
        }
        const index = activeWestern ? keyboardIndexForWestern(keys, activeWestern) : -1
        setActiveIndexes(index >= 0 ? new Set([index]) : new Set())
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [playing, paused, keys])

  useEffect(() => {
    if (!droneOn) return
    void startHarmoniumDrone(tonic)
  }, [droneOn, tonic, voiceRegister])

  useEffect(() => {
    stopHarmoniumSheet()
    setPlaying(false)
    setPaused(false)
    playbackRef.current = null
    clearHighlights()
  }, [song.id, tonic, clearHighlights])

  useEffect(() => {
    if (!playing || !playbackRef.current) return
    if (scheduledBpmRef.current === tempoBpm) return
    const timer = window.setTimeout(() => {
      const current = playbackRef.current
      if (!current) return
      const oldLast = current.events[current.events.length - 1]
      const oldEnd = oldLast ? oldLast.startSec + oldLast.durationSec : 0
      const now = getHarmoniumSheetSeconds()
      const progress = oldEnd > 0 ? Math.min(1, Math.max(0, now / oldEnd)) : 0
      const events = sampleSongPlayEvents(tonic, song, tempoBpm)
      const lines = sampleSongLineEvents(tonic, song, tempoBpm)
      playbackRef.current = { events, lines }
      scheduledBpmRef.current = tempoBpm
      const nextLast = events[events.length - 1]
      const nextEnd = nextLast ? nextLast.startSec + nextLast.durationSec : 0
      retargetHarmoniumSheet(events, progress * nextEnd, !paused)
    }, 40)
    return () => window.clearTimeout(timer)
  }, [tempoBpm, playing, paused, tonic, song])

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
    const key = keys[index]
    if (key) onReleaseKey?.(key)
  }, [keys, onReleaseKey])

  const pressKey = useCallback(async (key: HarmoniumKeyboardKey | undefined, index: number) => {
    if (!key || stopsRef.current.has(index)) return
    stopsRef.current.set(index, () => undefined)
    setActiveIndexes((current) => {
      const next = new Set(current)
      next.add(index)
      return next
    })
    onPressKey?.(key)
    const stop = await startWesternNote(key.western)
    if (!stopsRef.current.has(index)) {
      stop()
      return
    }
    stopsRef.current.set(index, stop)
  }, [onPressKey])

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
    setPaused(false)
    clearHighlights()
    try {
      await playSheetEvents(sargamPlayEvents(tonic, typed, tempoPreset.noteSec, tempoPreset.gapSec))
    } finally {
      setPlaying(false)
      setPaused(false)
    }
  }

  async function playSampleSong() {
    if (playing && paused) {
      resumeHarmoniumSheet()
      setPaused(false)
      return
    }
    if (playing) return
    setPlaying(true)
    setPaused(false)
    clearHighlights()
    const events = sampleSongPlayEvents(tonic, song, tempoBpm)
    const lines = sampleSongLineEvents(tonic, song, tempoBpm)
    playbackRef.current = { events, lines }
    scheduledBpmRef.current = tempoBpm
    try {
      await playSheetEvents(events)
    } finally {
      setPlaying(false)
      setPaused(false)
      playbackRef.current = null
      clearHighlights()
    }
  }

  function togglePause() {
    if (!playing) return
    if (paused) {
      resumeHarmoniumSheet()
      setPaused(false)
      return
    }
    pauseHarmoniumSheet()
    setPaused(true)
  }

  const activeLine = songLineIndex != null ? song.lines[songLineIndex] : null

  return (
    <section className="surface-card rounded-[1.75rem] p-5 text-navy-950 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Harmonium player</p>
          <h3 className="mt-2 font-serif text-3xl text-navy-950">Real reed samples</h3>
          {!compact ? (
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {ready ? "Yale Euterpea reeds · hold keys, play chords, add Sa–Pa drone" : "Loading reed samples… tap a key after they load"}
            </p>
          ) : null}
        </div>
        {onTonicChange ? (
          <label className="flex items-center gap-2 text-xs font-bold text-navy-950">
            Sa
            <select
              value={tonic}
              onChange={(event) => onTonicChange(event.target.value)}
              className="rounded-lg border border-gold-500/40 bg-white px-3 py-2"
            >
              {HARMONIUM_TONICS.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-xs text-stone-600">
            Sa = <strong className="text-navy-950">{tonic}</strong>
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-navy-900/10 bg-gold-50 p-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-navy-800">
          Bellows
          <input
            type="range"
            min={0.15}
            max={1}
            step={0.01}
            value={bellows}
            onChange={(event) => setBellows(Number(event.target.value))}
            aria-label="Bellows volume"
            className="w-32 accent-gold-500"
          />
        </label>
        <button
          type="button"
          aria-pressed={droneOn}
          onClick={() => {
            if (droneOn) {
              stopHarmoniumDrone()
              setDroneOn(false)
              return
            }
            void startHarmoniumDrone(tonic).then(() => setDroneOn(true))
          }}
          className={chipClass(droneOn)}
        >
          {droneOn ? "Drone on · Sa Pa" : "Drone off"}
        </button>
        <label className="flex items-center gap-2 text-xs font-semibold text-navy-800">
          Fine tune
          <input
            type="range"
            min={-50}
            max={50}
            step={1}
            value={fineTune}
            onChange={(event) => setFineTune(Number(event.target.value))}
            aria-label="Harmonium fine tune"
            className="w-32 accent-gold-500"
          />
          <span className="w-12 tabular-nums text-stone-500">
            {fineTune > 0 ? `+${fineTune}` : fineTune}¢
          </span>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Voice range">
        <span className="text-xs font-semibold text-navy-800">Voice</span>
        {HARMONIUM_VOICE_REGISTERS.map((register) => (
          <button
            key={register.id}
            type="button"
            aria-pressed={voiceRegister === register.id}
            onClick={() => setVoiceRegister(register.id)}
            className={chipClass(voiceRegister === register.id)}
          >
            {register.label}
          </button>
        ))}
        <span className="text-[11px] text-stone-500">Bass −8ve · Female +5th · High +8ve</span>
      </div>

      <div
        className="relative mt-4 overflow-x-auto rounded-[1.25rem] border border-navy-900/10 bg-navy-950 p-2 shadow-[0_16px_45px_rgba(42,31,15,0.12)]"
        role="group"
        aria-label="Virtual harmonium keyboard"
      >
        <div className="relative h-40 min-w-[36rem] overflow-hidden rounded-xl">
          <div className="flex h-full">
            {whiteKeys.map((key) => {
              const index = keys.indexOf(key)
              const active = activeIndexes.has(index)
              return (
                <button
                  key={key.western}
                  type="button"
                  className={`relative flex flex-1 flex-col items-center justify-end border-r border-navy-900/10 pb-2 last:border-r-0 ${
                    active ? "bg-gold-200" : key.isSa ? "bg-ivory-50" : "bg-ivory-100 hover:bg-gold-50"
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
                className={`absolute top-2 z-10 flex h-[58%] w-[4.6%] -translate-x-1/2 flex-col items-center justify-end rounded-b-md border border-navy-950 pb-1.5 text-white ${
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

      {keyboardOnly ? null : (
      <>
      <div className="mt-4 rounded-2xl border border-navy-900/10 bg-ivory-50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">{isSample ? "Sample song" : "Full sargam"}</p>
            <h4 className="mt-1 font-serif text-2xl text-navy-950">{song.title}</h4>
            <p className="text-sm text-stone-600" lang="hi">
              {song.titleHi}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {isSample
                ? "PS 1 · sargam from the Roman booklet (á = hold). Set Sa, then Play on keys."
                : "Roman sargam (á = hold), same style as the booklet. Set Sa, then Play on keys."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void playSampleSong()}
              disabled={playing && !paused}
              aria-label="Play on keys"
              className="gold-button px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {playing && !paused ? "Playing…" : "▶ Play on keys"}
            </button>
            <button
              type="button"
              onClick={togglePause}
              disabled={!playing}
              className="outline-button px-5 py-2.5 text-sm disabled:opacity-40"
            >
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
          </div>
        </div>
        <div className="mt-4">
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.24em] text-gold-700">
            Tempo tuner
            <input
              type="range"
              min={HARMONIUM_BPM_MIN}
              max={HARMONIUM_BPM_MAX}
              step={1}
              value={tempoBpm}
              aria-valuemin={HARMONIUM_BPM_MIN}
              aria-valuemax={HARMONIUM_BPM_MAX}
              aria-valuenow={tempoBpm}
              aria-valuetext={`${tempoBpm} BPM`}
              onChange={(event) => setTempoBpm(clampHarmoniumBpm(Number(event.target.value)))}
              className="w-full accent-gold-500"
            />
          </label>
          <div className="mt-2 flex flex-wrap rounded-lg border border-navy-900/10 bg-white p-1">
            {HARMONIUM_PLAY_TEMPO_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTempoBpm(HARMONIUM_PLAY_TEMPOS[id].bpm)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold ${
                  tempoPreset.nearestPreset === id ? "bg-navy-950 text-white" : "text-navy-950 hover:bg-gold-50"
                }`}
              >
                {HARMONIUM_PLAY_TEMPOS[id].label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-500">
            {tempoBpm} BPM
            {tempoPreset.nearestPreset ? ` · ${HARMONIUM_PLAY_TEMPOS[tempoPreset.nearestPreset].label}` : ""}
            {" · drag for any speed · breath after each line"}
          </p>
        </div>
        <ol className="mt-4 space-y-2 text-sm">
          {song.lines.map((line, index) => (
            <li
              key={`${index}-${line.lyric}`}
              className={`rounded-xl border px-3 py-2 ${
                songLineIndex === index
                  ? "border-gold-500/30 bg-gold-50 text-navy-950"
                  : "border-navy-900/8 bg-white text-navy-900"
              }`}
            >
              <p className="font-serif font-semibold">{line.lyric}</p>
              <p className="text-xs text-stone-600" lang="hi">
                {line.lyricHi}
              </p>
              <p className="mt-0.5 font-serif text-sm tracking-wide text-gold-900">{line.sargam}</p>
            </li>
          ))}
        </ol>
        {activeLine ? (
          <p className="mt-2 text-xs font-semibold text-gold-800">Now: {activeLine.lyric}</p>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-navy-900/10 bg-white p-4 sm:p-5">
        <label className="eyebrow block" htmlFor="sargam-type-input">
          Type sargam
        </label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            id="sargam-type-input"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Sa Re Ga Ma Pa Dha Ni Sa′  or  सा रे ग म प ध नि सां"
            className="min-w-0 flex-1 rounded-xl border border-gold-500/40 bg-ivory-50 px-3 py-2.5 text-sm text-navy-950"
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
            className="gold-button px-5 py-2.5 text-sm disabled:opacity-50"
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
              className="soft-chip"
            >
              {example}
            </button>
          ))}
        </div>
        {parsedPreview.length ? (
          <p className="mt-3 text-xs text-stone-600">
            {parsedPreview.length} swara{parsedPreview.length === 1 ? "" : "s"} ready ·{" "}
            {parsedPreview.map((item) => item.western).join(" · ")}
          </p>
        ) : null}
      </div>
      </>
      )}
    </section>
  )
}

function chipClass(active: boolean): string {
  return active
    ? "rounded-full bg-navy-950 px-3.5 py-1.5 text-xs font-semibold text-white"
    : "rounded-full border border-navy-900/10 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-800 transition hover:border-gold-500 hover:bg-gold-50"
}
