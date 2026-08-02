"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

import { trackEvent } from "@/lib/analytics"
import { useMember } from "@/components/member-provider"

const skipSeconds = 10

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  const remainder = whole % 60
  return `${minutes}:${remainder.toString().padStart(2, "0")}`
}

function IconButton({
  label,
  onClick,
  children,
  primary = false,
  "aria-pressed": ariaPressed,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  primary?: boolean
  "aria-pressed"?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={ariaPressed}
      onClick={onClick}
      className={
        primary
          ? "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-950 text-white transition hover:bg-navy-900"
          : "grid h-7 w-7 shrink-0 place-items-center rounded-full text-navy-950 transition hover:bg-ivory-100"
      }
    >
      {children}
    </button>
  )
}

function SkipBackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
      <path d="M11 5v14l-8-7 8-7zm9 0v14l-8-7 8-7z" />
    </svg>
  )
}

function SkipForwardIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
      <path d="M4 5v14l8-7-8-7zm9 0v14l8-7-8-7z" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-0.5 h-3.5 w-3.5 fill-current">
      <path d="M8 5v14l11-7-11-7z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  )
}

function CompactPlayer({
  url,
  title,
  provider,
  audioRef,
  playing,
  setPlaying,
  currentTime,
  setCurrentTime,
  duration,
  setDuration,
  seekBy,
  seekTo,
}: {
  url: string
  title: string
  provider?: string
  audioRef: React.RefObject<HTMLAudioElement | null>
  playing: boolean
  setPlaying: (value: boolean) => void
  currentTime: number
  setCurrentTime: (value: number) => void
  duration: number
  setDuration: (value: number) => void
  seekBy: (deltaSeconds: number) => void
  seekTo: (nextTime: number) => void
}) {
  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      return
    }
    void audio.play()
  }

  return (
    <div
      className="w-full rounded-xl border border-navy-900/10 bg-white px-2.5 py-2 shadow-sm"
      title={provider ? "Verified recording" : undefined}
    >
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label={`Rewind ${skipSeconds} seconds`} onClick={() => seekBy(-skipSeconds)}>
            <SkipBackIcon />
          </IconButton>
          <IconButton
            label={playing ? `Pause ${title}` : `Play ${title}`}
            onClick={togglePlay}
            primary
            aria-pressed={playing}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </IconButton>
          <IconButton label={`Forward ${skipSeconds} seconds`} onClick={() => seekBy(skipSeconds)}>
            <SkipForwardIcon />
          </IconButton>
        </div>

        <span className="w-8 shrink-0 text-[10px] tabular-nums text-stone-500">{formatTime(currentTime)}</span>
        <label className="sr-only" htmlFor={`audio-progress-${title}`}>
          Seek through {title}
        </label>
        <input
          id={`audio-progress-${title}`}
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => seekTo(Number(event.target.value))}
          className="h-1 min-w-0 flex-1 cursor-pointer accent-gold-600"
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
        />
        <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-stone-500">
          {formatTime(duration)}
        </span>
      </div>

      <audio
        ref={audioRef}
        aria-label={`Listen to ${title}`}
        preload="metadata"
        src={url}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => {
          setPlaying(true)
          trackEvent("feature_use", "audio_play")
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="sr-only"
      />
    </div>
  )
}

export function AudioRendition({
  url,
  title,
  provider,
  featured = false,
  compact = false,
}: {
  url: string
  title: string
  provider?: string
  featured?: boolean
  compact?: boolean
}) {
  const { session } = useMember()
  const signedIn = session.authenticated
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [url])

  function seekBy(deltaSeconds: number) {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration)) return
    const next = Math.min(Math.max(0, audio.currentTime + deltaSeconds), audio.duration)
    audio.currentTime = next
    setCurrentTime(next)
  }

  function seekTo(nextTime: number) {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration)) return
    const clamped = Math.min(Math.max(0, nextTime), audio.duration)
    audio.currentTime = clamped
    setCurrentTime(clamped)
  }

  if (compact) {
    return (
      <CompactPlayer
        url={url}
        title={title}
        provider={provider}
        audioRef={audioRef}
        playing={playing}
        setPlaying={setPlaying}
        currentTime={currentTime}
        setCurrentTime={setCurrentTime}
        duration={duration}
        setDuration={setDuration}
        seekBy={seekBy}
        seekTo={seekTo}
      />
    )
  }

  return (
    <article
      className={`rounded-2xl border p-4 ${featured ? "border-gold-500/50 bg-gold-50" : "border-navy-900/10 bg-white"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-navy-950">{title}</p>
          {provider ? (
            <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-stone-500">Verified recording</p>
          ) : null}
        </div>
        <span className="text-gold-700">♪</span>
      </div>
      <audio
        aria-label={`Listen to ${title}`}
        controls
        controlsList={signedIn ? "noplaybackrate" : "nodownload noplaybackrate"}
        preload="none"
        src={url}
        onPlay={() => trackEvent("feature_use", "audio_play")}
        onContextMenu={(event) => {
          if (!signedIn) event.preventDefault()
        }}
        className="mt-3 w-full"
      />
      {signedIn ? (
        <a href={url} download data-feature="audio_download" className="mt-3 inline-flex text-xs font-semibold text-gold-700">
          Download audio
        </a>
      ) : (
        <p className="mt-3 text-[10px] text-stone-500">Sign in to enable the download option.</p>
      )}
    </article>
  )
}
