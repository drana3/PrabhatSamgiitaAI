"use client"

import { trackEvent } from "@/lib/analytics"
import { useMember } from "@/components/member-provider"

export function AudioRendition({ url, title, provider, featured = false, compact = false }: { url: string; title: string; provider?: string; featured?: boolean; compact?: boolean }) {
  const { session } = useMember()
  const signedIn = session.authenticated

  if (compact) {
    return <audio aria-label={`Listen to ${title}`} controls controlsList={signedIn ? "noplaybackrate" : "nodownload noplaybackrate"} preload="none" src={url} onPlay={() => trackEvent("feature_use", "audio_play")} onContextMenu={(event) => { if (!signedIn) event.preventDefault() }} className="h-9 w-full max-w-56" />
  }

  return <article className={`rounded-2xl border p-4 ${featured ? "border-gold-500/50 bg-gold-50" : "border-navy-900/10 bg-white"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-navy-950">{title}</p>{provider ? <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-stone-500">Verified recording</p> : null}</div><span className="text-gold-700">♪</span></div><audio aria-label={`Listen to ${title}`} controls controlsList={signedIn ? "noplaybackrate" : "nodownload noplaybackrate"} preload="none" src={url} onPlay={() => trackEvent("feature_use", "audio_play")} onContextMenu={(event) => { if (!signedIn) event.preventDefault() }} className="mt-3 w-full" />{signedIn ? <a href={url} download data-feature="audio_download" className="mt-3 inline-flex text-xs font-semibold text-gold-700">Download audio</a> : <p className="mt-3 text-[10px] text-stone-500">Sign in to enable the download option.</p>}</article>
}
