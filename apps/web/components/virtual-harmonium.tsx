"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"

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
  splitBookletLyric,
  sargamPlayEvents,
  type HarmoniumKeyboardKey,
  type HarmoniumSampleSong,
  type HarmoniumVoiceRegister,
} from "@prabhat/core"

import { playSheetEvents, startWesternNote, stopActiveWesternNote, ensureHarmoniumPlayer, setHarmoniumBellows, setHarmoniumFineTune, setHarmoniumVoiceRegister, startHarmoniumDrone, stopHarmoniumDrone, pauseHarmoniumSheet, resumeHarmoniumSheet, stopHarmoniumSheet, getHarmoniumSheetSeconds, retargetHarmoniumSheet, setHarmoniumSheetHighlightListener, type SheetPlaybackHandlers } from "@/lib/harmonium-playback"

type Props = {
  tonic: string
  onTonicChange?: (tonic: string) => void
  compact?: boolean
  song?: HarmoniumSampleSong
  keyboardOnly?: boolean
  captureMode?: boolean
  tempoBpm?: number
  onTempoBpmChange?: (bpm: number) => void
  onPressKey?: (key: HarmoniumKeyboardKey) => void
  onReleaseKey?: (key: HarmoniumKeyboardKey) => void
}

function chipClass(active: boolean): string {
  return active
    ? "rounded-full bg-navy-950 px-3.5 py-1.5 text-xs font-semibold text-white"
    : "rounded-full border border-navy-900/10 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-800 transition hover:border-gold-500 hover:bg-gold-50"
}

function HarmoniumTuningPanel({
  bellows,
  onBellowsChange,
  droneOn,
  onDroneToggle,
  fineTune,
  onFineTuneChange,
  voiceRegister,
  onVoiceRegisterChange,
  tempoBpm,
  onTempoBpmChange,
  tempoPreset,
}: {
  bellows: number
  onBellowsChange: (value: number) => void
  droneOn: boolean
  onDroneToggle: () => void
  fineTune: number
  onFineTuneChange: (value: number) => void
  voiceRegister: HarmoniumVoiceRegister
  onVoiceRegisterChange: (value: HarmoniumVoiceRegister) => void
  tempoBpm: number
  onTempoBpmChange: (value: number) => void
  tempoPreset: ReturnType<typeof sampleSongTiming>
}) {
  return (
    <div className="mt-4 rounded-2xl border border-navy-900/10 bg-gold-50/70 p-4 sm:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gold-700">Reed & tempo tuner</p>
      <p className="mt-1 text-xs text-stone-600">
        Bellows, drone, voice, fine tune, and speed apply to live keys, Play on keys, and typed sargam.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-navy-900/10 bg-white p-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-navy-800">
          Bellows
          <input
            type="range"
            min={0.15}
            max={1}
            step={0.01}
            value={bellows}
            onChange={(event) => onBellowsChange(Number(event.target.value))}
            aria-label="Bellows volume"
            className="w-32 accent-gold-500"
          />
        </label>
        <button
          type="button"
          aria-pressed={droneOn}
          onClick={onDroneToggle}
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
            onChange={(event) => onFineTuneChange(Number(event.target.value))}
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
            onClick={() => onVoiceRegisterChange(register.id)}
            className={chipClass(voiceRegister === register.id)}
          >
            {register.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.24em] text-gold-700">
          Tempo
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
            onChange={(event) => onTempoBpmChange(clampHarmoniumBpm(Number(event.target.value)))}
            className="w-full accent-gold-500"
          />
        </label>
        <div className="mt-2 flex flex-wrap rounded-lg border border-navy-900/10 bg-white p-1">
          {HARMONIUM_PLAY_TEMPO_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onTempoBpmChange(HARMONIUM_PLAY_TEMPOS[id].bpm)}
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
          {" · note "}
          {tempoPreset.noteSec.toFixed(2)}s · breath {tempoPreset.gapSec.toFixed(2)}s
        </p>
      </div>
    </div>
  )
}

export const VirtualHarmonium = memo(function VirtualHarmonium({
  tonic,
  onTonicChange,
  compact = false,
  song = BANDHU_HE_NIYE_CALO_SONG,
  keyboardOnly = false,
  captureMode = false,
  tempoBpm: controlledTempoBpm,
  onTempoBpmChange,
  onPressKey,
  onReleaseKey,
}: Props) {
  const [typed, setTyped] = useState("")
  const [activeIndexes, setActiveIndexes] = useState<Set<number>>(new Set())
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [songLineIndex, setSongLineIndex] = useState<number | null>(null)
  const [ready, setReady] = useState(false)
  const [droneOn, setDroneOn] = useState(false)
  const [bellows, setBellows] = useState(0.7)
  const [fineTune, setFineTune] = useState(0)
  const [voiceRegister, setVoiceRegister] = useState<HarmoniumVoiceRegister>("male")
  const [internalTempoBpm, setInternalTempoBpm] = useState(HARMONIUM_BPM_DEFAULT)
  const tempoBpm = controlledTempoBpm ?? internalTempoBpm
  const setTempoBpm = useCallback(
    (bpm: number) => {
      onTempoBpmChange?.(bpm)
      if (controlledTempoBpm === undefined) setInternalTempoBpm(bpm)
    },
    [controlledTempoBpm, onTempoBpmChange],
  )
  const stopsRef = useRef(new Map<number, () => void>())
  const playbackRef = useRef<{ events: ReturnType<typeof sampleSongPlayEvents>; lines: ReturnType<typeof sampleSongLineEvents> } | null>(null)
  const playbackModeRef = useRef<"sample" | "typed" | null>(null)
  const scheduledBpmRef = useRef(tempoBpm)
  const keys = useMemo(() => harmoniumKeyboardLayout(tonic), [tonic])
  const whiteKeys = useMemo(() => keys.filter((key) => !key.isBlack), [keys])
  const blackKeys = useMemo(() => keys.filter((key) => key.isBlack), [keys])
  const parsedPreview = useMemo(() => parseSargamInput(typed, tonic), [typed, tonic])
  const tempoPreset = sampleSongTiming(tempoBpm)
  const isSample = song.id === BANDHU_HE_NIYE_CALO_SONG.id
  const songSargamChips = useMemo(() => {
    const seen = new Set<string>()
    return song.lines
      .map((line) => line.sargam)
      .filter((sargam) => {
        if (seen.has(sargam)) return false
        seen.add(sargam)
        return true
      })
  }, [song.lines])
  const typedUsesTaar = useMemo(() => {
    if (!typed.trim()) return false
    if ((typed.match(/[\p{L}\p{M}]+['′`]/gu)?.length ?? 0) >= 2) return true
    return parsedPreview.some((item) => item.octave === "upper")
  }, [typed, parsedPreview])
  const typedExamples = songSargamChips.length ? songSargamChips : [...SARGAM_EXAMPLES]

  const buildTypedEvents = useCallback(() => {
    const timing = sampleSongTiming(tempoBpm)
    return sargamPlayEvents(tonic, typed, 60 / timing.bpm, timing.gapSec)
  }, [tempoBpm, tonic, typed])

  const clearHighlights = useCallback(() => {
    setSongLineIndex(null)
    setActiveIndexes(new Set())
    setPlaybackIndex(null)
  }, [])

  const applyPlaybackHighlight = useCallback((western: string | null) => {
    if (!western) {
      setPlaybackIndex(null)
      return
    }
    const index = keyboardIndexForWestern(keys, western)
    setPlaybackIndex(index >= 0 ? index : null)
  }, [keys])

  const playbackHandlers = useMemo<SheetPlaybackHandlers>(
    () => ({ onKeyHighlight: applyPlaybackHighlight }),
    [applyPlaybackHighlight],
  )

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
    setHarmoniumSheetHighlightListener(applyPlaybackHighlight)
    return () => setHarmoniumSheetHighlightListener(null)
  }, [applyPlaybackHighlight])

  useEffect(() => {
    if (!playing || paused) return
    let frame = 0
    let lastPlaybackIndex: number | null = null
    let lastLineIndex: number | null = null
    const tick = () => {
      const now = getHarmoniumSheetSeconds()
      const playback = playbackRef.current
      if (playback) {
        let activeWestern: string | null = null
        for (const event of playback.events) {
          if (now >= event.startSec && now < event.startSec + event.durationSec) {
            activeWestern = event.western
          }
        }
        const index = activeWestern ? keyboardIndexForWestern(keys, activeWestern) : -1
        const nextPlaybackIndex = index >= 0 ? index : null
        if (nextPlaybackIndex !== lastPlaybackIndex) {
          lastPlaybackIndex = nextPlaybackIndex
          setPlaybackIndex(nextPlaybackIndex)
        }
        if (playback.lines.length) {
          let lineIndex: number | null = null
          for (const [idx, line] of playback.lines.entries()) {
            if (now >= line.startSec) lineIndex = idx
          }
          if (lineIndex !== lastLineIndex) {
            lastLineIndex = lineIndex
            setSongLineIndex(lineIndex)
          }
        }
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
      const events =
        playbackModeRef.current === "typed"
          ? buildTypedEvents()
          : sampleSongPlayEvents(tonic, song, tempoBpm)
      const lines =
        playbackModeRef.current === "typed" ? [] : sampleSongLineEvents(tonic, song, tempoBpm)
      playbackRef.current = { events, lines }
      scheduledBpmRef.current = tempoBpm
      const nextLast = events[events.length - 1]
      const nextEnd = nextLast ? nextLast.startSec + nextLast.durationSec : 0
      retargetHarmoniumSheet(events, progress * nextEnd, !paused, playbackHandlers)
    }, 40)
    return () => window.clearTimeout(timer)
  }, [tempoBpm, playing, paused, tonic, song, buildTypedEvents])

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
    const events = buildTypedEvents()
    playbackRef.current = { events, lines: [] }
    playbackModeRef.current = "typed"
    scheduledBpmRef.current = tempoBpm
    try {
      await playSheetEvents(events, playbackHandlers)
    } finally {
      setPlaying(false)
      setPaused(false)
      playbackRef.current = null
      playbackModeRef.current = null
      clearHighlights()
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
    playbackModeRef.current = "sample"
    scheduledBpmRef.current = tempoBpm
    try {
      await playSheetEvents(events, playbackHandlers)
    } finally {
      setPlaying(false)
      setPaused(false)
      playbackRef.current = null
      playbackModeRef.current = null
      clearHighlights()
    }
  }

  function stopPlayback() {
    stopHarmoniumSheet()
    setPlaying(false)
    setPaused(false)
    playbackRef.current = null
    playbackModeRef.current = null
    clearHighlights()
  }

  function resetSongPlayback() {
    stopPlayback()
  }

  function resetTypedPlayback() {
    stopPlayback()
    setTyped("")
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
  const showSampleSong = !keyboardOnly && !captureMode
  const showPlayerTools = !keyboardOnly || captureMode

  return (
    <section className="surface-card rounded-[1.75rem] p-5 text-navy-950 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {keyboardOnly && !captureMode ? (
            <>
              <p className="eyebrow">Line capture</p>
              <h3 className="mt-2 font-serif text-2xl text-navy-950">Virtual harmonium</h3>
              <p className="mt-1 text-sm text-stone-600">
                {ready ? "Hold keys to record · Sa below" : "Loading samples…"}
              </p>
            </>
          ) : (
            <>
              <p className="eyebrow">{captureMode ? "Capture studio" : "Harmonium player"}</p>
              <h3 className="mt-2 font-serif text-3xl text-navy-950">Real reed samples</h3>
              {!compact ? (
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {ready
                    ? captureMode
                      ? "Same reed engine as learner practice · tune Sa, bellows, drone, and tempo before you record"
                      : "Yale Euterpea reeds · hold keys, play chords, add Sa–Pa drone"
                    : "Loading reed samples… tap a key after they load"}
                </p>
              ) : null}
            </>
          )}
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

      <div
        className="relative mt-4 overflow-x-auto rounded-[1.25rem] border border-navy-900/10 bg-navy-950 p-2 shadow-[0_16px_45px_rgba(42,31,15,0.12)]"
        role="group"
        aria-label="Virtual harmonium keyboard"
      >
        <p className="mb-2 text-[10px] font-semibold text-gold-200/90">
          Auto-play lights the matching key in amber. PS 1–2 use middle octave; PS 4 uses taar (Sa′); black keys
          light for komal swaras (e.g. type <span className="font-serif">Sa re ga ma</span>).
        </p>
        <div className="relative h-40 min-w-[36rem] overflow-hidden rounded-xl">
          <div className="flex h-full">
            {whiteKeys.map((key) => {
              const index = keys.indexOf(key)
              const active = activeIndexes.has(index) || playbackIndex === index
              return (
                <button
                  key={key.western}
                  type="button"
                  className={`relative flex flex-1 flex-col items-center justify-end border-r border-navy-900/10 pb-2 last:border-r-0 transition-colors duration-75 ${
                    active
                      ? "bg-amber-300 shadow-[inset_0_0_0_2px_#d97706] ring-2 ring-amber-500"
                      : key.isSa
                        ? "bg-ivory-50"
                        : "bg-ivory-100 hover:bg-gold-50"
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
            const active = activeIndexes.has(index) || playbackIndex === index
            return (
              <button
                key={key.western}
                type="button"
                className={`absolute top-2 z-10 flex h-[58%] w-[4.6%] -translate-x-1/2 flex-col items-center justify-end rounded-b-md border pb-1.5 text-white transition-all duration-75 ${
                  active
                    ? "border-white bg-amber-400 shadow-[0_0_0_2px_#fff,0_0_12px_rgba(251,191,36,0.85)] scale-105"
                    : "border-navy-950 bg-navy-950 hover:bg-navy-800"
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

      {showSampleSong ? (
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
            <button
              type="button"
              onClick={stopPlayback}
              disabled={!playing}
              aria-label="Stop song"
              className="outline-button px-5 py-2.5 text-sm disabled:opacity-40"
            >
              Stop
            </button>
            <button
              type="button"
              onClick={resetSongPlayback}
              aria-label="Reset song"
              className="outline-button px-5 py-2.5 text-sm"
            >
              Reset
            </button>
          </div>
        </div>
        <ol className="mt-4 space-y-2 text-sm">
          {song.lines.map((line, index) => (
            <li
              key={`${index}-${line.sargam}`}
              className={`rounded-xl border px-3 py-2 ${
                songLineIndex === index
                  ? "border-gold-500/30 bg-gold-50 text-navy-950"
                  : "border-navy-900/8 bg-white text-navy-900"
              }`}
            >
              {line.bookletMarker ? (
                <span className="mb-1 inline-block rounded bg-navy-900/8 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy-700">
                  {line.bookletMarker}
                </span>
              ) : null}
              <div className="font-serif font-semibold">
                {splitBookletLyric(line.lyric).map((part) => (
                  <p key={part}>{part}</p>
                ))}
              </div>
              <div className="text-xs text-stone-600" lang="hi">
                {splitBookletLyric(line.lyricHi).map((part) => (
                  <p key={part}>{part}</p>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setTyped(line.sargam)}
                title="Use in typed sargam player"
                className="mt-0.5 block w-full rounded-lg px-1 py-0.5 text-left font-serif text-sm tracking-wide text-gold-900 hover:bg-gold-100/80"
              >
                {line.sargam}
              </button>
            </li>
          ))}
        </ol>
        {activeLine ? (
          <p className="mt-2 text-xs font-semibold text-gold-800">
            Now: {splitBookletLyric(activeLine.lyric).join(" · ")}
            {song.lines.filter((line) => line.lyric === activeLine.lyric).length > 1 ? (
              <span className="font-serif font-normal text-gold-900"> · {activeLine.sargam.split("|")[0]?.trim()}</span>
            ) : null}
          </p>
        ) : null}
      </div>
      ) : null}

      {showPlayerTools ? (
      <>
      <HarmoniumTuningPanel
        bellows={bellows}
        onBellowsChange={setBellows}
        droneOn={droneOn}
        onDroneToggle={() => {
          if (droneOn) {
            stopHarmoniumDrone()
            setDroneOn(false)
            return
          }
          void startHarmoniumDrone(tonic).then(() => setDroneOn(true))
        }}
        fineTune={fineTune}
        onFineTuneChange={setFineTune}
        voiceRegister={voiceRegister}
        onVoiceRegisterChange={setVoiceRegister}
        tempoBpm={tempoBpm}
        onTempoBpmChange={setTempoBpm}
        tempoPreset={tempoPreset}
      />

      {captureMode ? null : (
      <div className="mt-4 rounded-2xl border border-navy-900/10 bg-white p-4 sm:p-5">
        <label className="eyebrow block" htmlFor="sargam-type-input">
          Type sargam
        </label>
        <p className="mt-2 text-xs text-stone-600">
          Play on keys follows the sargam under each lyric (middle octave, á = hold). Typed sargam plays
          exactly what you enter — lines with Sa′ are taar (higher) and differ from the sample refrain.
        </p>
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
            disabled={!typed.trim() || (playing && !paused)}
            className="gold-button px-5 py-2.5 text-sm disabled:opacity-50"
          >
            {playing && !paused ? "Playing…" : "▶ Play"}
          </button>
          <button
            type="button"
            onClick={stopPlayback}
            disabled={!playing}
            aria-label="Stop typed sargam"
            className="outline-button px-5 py-2.5 text-sm disabled:opacity-40"
          >
            Stop
          </button>
          <button
            type="button"
            onClick={resetTypedPlayback}
            aria-label="Reset typed sargam"
            className="outline-button px-5 py-2.5 text-sm"
          >
            Reset
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {typedExamples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setTyped(example)}
              className="soft-chip max-w-full truncate"
              title={example}
            >
              {songSargamChips.length ? "From song · " : ""}
              {example.length > 42 ? `${example.slice(0, 42)}…` : example}
            </button>
          ))}
        </div>
        {parsedPreview.length ? (
          <p className="mt-3 text-xs text-stone-600">
            {parsedPreview.length} swara{parsedPreview.length === 1 ? "" : "s"} ready ·{" "}
            {parsedPreview.map((item) => item.western).join(" · ")}
            {typedUsesTaar ? " · taar register (Sa′)" : " · middle register"}
          </p>
        ) : null}
      </div>
      )}
      </>
      ) : null}
    </section>
  )
})
