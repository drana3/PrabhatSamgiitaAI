"use client"

import { useEffect, useMemo, useState } from "react"
import { audioFreshnessBadge, type RankedAudio } from "@prabhat/core"

import { AudioRendition } from "@/components/audio-rendition"
import { defaultSongAudioUrl, writePreferredAudio } from "@/lib/preferred-audio"

export function SongListenPanel({
  songNumber,
  recordings,
  compact = false,
}: {
  songNumber: number
  recordings: RankedAudio[]
  compact?: boolean
}) {
  const latestUrl = recordings.find((item) => item.isLatest)?.url ?? recordings[0]?.url ?? null
  const [url, setUrl] = useState(latestUrl)

  useEffect(() => {
    setUrl(defaultSongAudioUrl(recordings, songNumber) ?? latestUrl)
  }, [latestUrl, recordings, songNumber])

  const selected = useMemo(
    () => recordings.find((item) => item.url === url) ?? recordings[0],
    [recordings, url],
  )
  if (!selected) return null

  const showList = recordings.length > 1
  const selectedBadge = showList ? audioFreshnessBadge(selected) : null
  const title = [selectedBadge, selected.title].filter(Boolean).join(" · ")

  function selectRecording(nextUrl: string) {
    setUrl(nextUrl)
    writePreferredAudio(songNumber, nextUrl === latestUrl ? null : nextUrl)
  }

  return (
    <div className="space-y-4">
      <AudioRendition url={selected.url} title={title} provider={selected.provider} compact={compact} />
      {showList ? (
        <details className="rounded-2xl border border-navy-900/10 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-gold-700">
            More recordings ({recordings.length})
          </summary>
          <p className="mt-2 text-xs text-stone-500">
            The best recording plays by default. Choose another take to remember it for this song.
          </p>
          <ul className="mt-3 space-y-2">
            {recordings.map((item) => {
              const active = item.url === selected.url
              const badge = audioFreshnessBadge(item)
              return (
                <li key={item.url}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectRecording(item.url)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left ${
                      active
                        ? "border-gold-500 bg-gold-50"
                        : "border-navy-900/10 bg-ivory-50 hover:border-gold-500"
                    }`}
                  >
                    <span>
                      {badge ? (
                        <span
                          className={`block text-[10px] font-bold uppercase tracking-[0.14em] ${
                            item.isLatest ? "text-emerald-700" : "text-stone-500"
                          }`}
                        >
                          {badge}
                        </span>
                      ) : null}
                      <span className="text-sm font-semibold text-navy-950">{item.title}</span>
                    </span>
                    <span className="text-xs font-semibold text-gold-700">{active ? "Playing" : "Play"}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
