"use client"

import { useEffect, useRef, useState } from "react"

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

export function AudioRendition({ url, title, provider, featured = false, compact = false }: { url: string; title: string; provider?: string; featured?: boolean; compact?: boolean }) {
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
      <div className="w-full max-w-[17rem] rounded-2xl border border-navy-900/10 bg-white px-3 py-2.5 shadow-sm">
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            aria-label={`Rewind ${skipSeconds} seconds`}
            onClick={() => seekBy(-skipSeconds)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm text-navy-950 transition hover:bg-ivory-100"
          >
            ⏪
          </button>
          <button
            type="button"
            aria-label={playing ? `Pause ${title}` : `Play ${title}`}
            aria-pressed={playing}
            onClick={() => {
              const audio = audioRef.current
              if (!audio) return
              if (playing) {
                audio.pause()
                return
              }
              void audio.play()
            }}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-950 pl-0.5 text-sm text-white shadow-md transition hover:bg-navy-900"
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button
            type="button"
            aria-label={`Forward ${skipSeconds} seconds`}
            onClick={() => seekBy(skipSeconds)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm text-navy-950 transition hover:bg-ivory-100"
          >
            ⏩
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="w-9 text-[10px] tabular-nums text-stone-500">{formatTime(currentTime)}</span>
          <label className="sr-only" htmlFor={`audio-progress-${title}`}>Seek through {title}</label>
          <input
            id={`audio-progress-${title}`}
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => seekTo(Number(event.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-gold-600"
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          />
          <span className="w-9 text-right text-[10px] tabular-nums text-stone-500">{formatTime(duration)}</span>
        </div>
        {provider ? <p className="mt-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">Verified recording</p> : null}
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

  return <article className={`rounded-2xl border p-4 ${featured ? "border-gold-500/50 bg-gold-50" : "border-navy-900/10 bg-white"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-navy-950">{title}</p>{provider ? <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-stone-500">Verified recording</p> : null}</div><span className="text-gold-700">♪</span></div><audio aria-label={`Listen to ${title}`} controls controlsList={signedIn ? "noplaybackrate" : "nodownload noplaybackrate"} preload="none" src={url} onPlay={() => trackEvent("feature_use", "audio_play")} onContextMenu={(event) => { if (!signedIn) event.preventDefault() }} className="mt-3 w-full" />{signedIn ? <a href={url} download data-feature="audio_download" className="mt-3 inline-flex text-xs font-semibold text-gold-700">Download audio</a> : <p className="mt-3 text-[10px] text-stone-500">Sign in to enable the download option.</p>}</article>
}
