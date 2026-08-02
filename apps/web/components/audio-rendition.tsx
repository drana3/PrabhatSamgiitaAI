"use client"

import { useRef, useState } from "react"

import { trackEvent } from "@/lib/analytics"
import { useMember } from "@/components/member-provider"

export function AudioRendition({ url, title, provider, featured = false, compact = false }: { url: string; title: string; provider?: string; featured?: boolean; compact?: boolean }) {
  const { session } = useMember()
  const signedIn = session.authenticated
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  if (compact) {
    return (
      <div className="flex items-center gap-2">
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
        <audio
          ref={audioRef}
          aria-label={`Listen to ${title}`}
          preload="none"
          src={url}
          onPlay={() => {
            setPlaying(true)
            trackEvent("feature_use", "audio_play")
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="sr-only"
        />
        {provider ? <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">Verified</span> : null}
      </div>
    )
  }

  return <article className={`rounded-2xl border p-4 ${featured ? "border-gold-500/50 bg-gold-50" : "border-navy-900/10 bg-white"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-navy-950">{title}</p>{provider ? <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-stone-500">Verified recording</p> : null}</div><span className="text-gold-700">♪</span></div><audio aria-label={`Listen to ${title}`} controls controlsList={signedIn ? "noplaybackrate" : "nodownload noplaybackrate"} preload="none" src={url} onPlay={() => trackEvent("feature_use", "audio_play")} onContextMenu={(event) => { if (!signedIn) event.preventDefault() }} className="mt-3 w-full" />{signedIn ? <a href={url} download data-feature="audio_download" className="mt-3 inline-flex text-xs font-semibold text-gold-700">Download audio</a> : <p className="mt-3 text-[10px] text-stone-500">Sign in to enable the download option.</p>}</article>
}
