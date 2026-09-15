"use client"

import { useState } from "react"

import { trackEvent } from "@/lib/analytics"
import { useMember } from "@/components/member-provider"

function controlsList(signedIn: boolean) {
  return signedIn ? "noplaybackrate" : "nodownload noplaybackrate"
}

export function AudioRendition({
  url,
  title,
  provider,
  featured = false,
  warmStream = false,
}: {
  url: string
  title: string
  provider?: string
  featured?: boolean
  /** Preload duration only on the primary player so playback starts faster without downloading the full file. */
  warmStream?: boolean
}) {
  const { loading, session } = useMember()
  const allowDownload = !loading && session.authenticated
  const [loadError, setLoadError] = useState(false)

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
        key={url}
        aria-label={`Listen to ${title}`}
        controls
        controlsList={controlsList(allowDownload)}
        preload={warmStream ? "metadata" : "none"}
        src={url}
        onPlay={() => trackEvent("feature_use", "audio_play")}
        onError={() => setLoadError(true)}
        onLoadedData={() => setLoadError(false)}
        onContextMenu={(event) => {
          if (!allowDownload) event.preventDefault()
        }}
        className="mt-3 w-full"
      />
      {loadError ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          Couldn&apos;t load this recording. Try again or choose another take below.
        </p>
      ) : null}
      {!allowDownload ? (
        <p className="mt-3 text-[10px] text-stone-500">Sign in to enable download from the player menu.</p>
      ) : null}
    </article>
  )
}
