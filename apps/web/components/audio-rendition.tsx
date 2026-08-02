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

function controlsList(signedIn: boolean) {
  return signedIn ? "noplaybackrate" : "nodownload noplaybackrate"
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

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current text-stone-500">
      {muted ? (
        <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.06a2.5 2.5 0 0 1 0 4.02v2.06A4.5 4.5 0 0 0 16.5 12zM19 12a7.5 7.5 0 0 1-.75 3.27l1.46 1.46A9.003 9.003 0 0 0 21 12c0-2.4-.94-4.58-2.48-6.19l-1.46 1.46A7.502 7.502 0 0 1 19 12zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
      ) : (
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.03v8.05a4.47 4.47 0 0 0 2.5-3.08zM14 3.23v2.06a6.98 6.98 0 0 1 0 13.54v2.06a9 9 0 0 0 0-17.66z" />
      )}
    </svg>
  )
}

function CompactPlayer({
  url,
  title,
}: {
  url: string
  title: string
  provider?: string
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [url])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = volume
  }, [volume, url])

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

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      return
    }
    void audio.play()
  }

  function toggleMute() {
    setVolume((current) => (current > 0 ? 0 : 1))
  }

  const fieldId = title.replace(/\s+/g, "-").toLowerCase()

  return (
    <div className="w-full max-w-[20rem] rounded-xl border border-navy-900/10 bg-white px-2 py-2 shadow-sm">
      <div className="flex items-center gap-1.5">
        <div className="flex shrink-0 items-center">
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

        <span className="hidden w-8 shrink-0 text-[10px] tabular-nums text-stone-500 sm:inline">
          {formatTime(currentTime)}
        </span>
        <label className="sr-only" htmlFor={`audio-progress-${fieldId}`}>
          Seek through {title}
        </label>
        <input
          id={`audio-progress-${fieldId}`}
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => seekTo(Number(event.target.value))}
          className="h-1 min-w-[3.5rem] flex-1 cursor-pointer accent-gold-600"
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
        />
        <span className="hidden w-8 shrink-0 text-right text-[10px] tabular-nums text-stone-500 sm:inline">
          {formatTime(duration)}
        </span>

        <div className="flex shrink-0 items-center gap-1 border-l border-navy-900/10 pl-1.5">
          <button
            type="button"
            aria-label={volume > 0 ? "Mute" : "Unmute"}
            onClick={toggleMute}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-navy-950 transition hover:bg-ivory-100"
          >
            <VolumeIcon muted={volume === 0} />
          </button>
          <label className="sr-only" htmlFor={`audio-volume-${fieldId}`}>
            Volume for {title}
          </label>
          <input
            id={`audio-volume-${fieldId}`}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            className="h-1 w-10 cursor-pointer accent-gold-600 sm:w-12"
            aria-valuetext={`${Math.round(volume * 100)} percent`}
          />
        </div>
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

function NativeAudio({
  url,
  title,
  signedIn,
  className,
}: {
  url: string
  title: string
  signedIn: boolean
  className?: string
}) {
  return (
    <audio
      aria-label={`Listen to ${title}`}
      controls
      controlsList={controlsList(signedIn)}
      preload="none"
      src={url}
      onPlay={() => trackEvent("feature_use", "audio_play")}
      onContextMenu={(event) => {
        if (!signedIn) event.preventDefault()
      }}
      className={className}
    />
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

  if (compact) {
    return <CompactPlayer url={url} title={title} provider={provider} />
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
      <NativeAudio url={url} title={title} signedIn={signedIn} className="mt-3 w-full" />
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
