"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { RankedAudio } from "@prabhat/core"
import { audioFreshnessBadge } from "@prabhat/core"

import { AudioRendition } from "@/components/audio-rendition"
import { defaultSongAudioUrl, writePreferredAudio } from "@/lib/preferred-audio"
import { useSongPageLayout } from "@/lib/use-song-page-layout"
import { warmArchiveAudioStream } from "@/lib/warm-audio-stream"

type SongListenContextValue = {
  songNumber: number
  recordings: RankedAudio[]
  selected: RankedAudio
  selectRecording: (url: string) => void
  tryNextRecording: (failedUrl: string) => void
  showList: boolean
}

const SongListenContext = createContext<SongListenContextValue | null>(null)

function useSongListen() {
  const value = useContext(SongListenContext)
  if (!value) throw new Error("SongListenProvider is required")
  return value
}

export function SongPageListenShell({
  songNumber,
  recordings,
  children,
}: {
  songNumber: number
  recordings: RankedAudio[]
  children: ReactNode
}) {
  if (!recordings.length) return children
  return (
    <SongListenProvider songNumber={songNumber} recordings={recordings}>
      {children}
    </SongListenProvider>
  )
}

function SongListenProvider({
  songNumber,
  recordings,
  children,
}: {
  songNumber: number
  recordings: RankedAudio[]
  children: ReactNode
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

  useEffect(() => {
    if (!selected?.url) return
    void warmArchiveAudioStream(selected.url)
  }, [selected?.url])

  if (!selected) return null

  function selectRecording(nextUrl: string) {
    setUrl(nextUrl)
    writePreferredAudio(songNumber, nextUrl === latestUrl ? null : nextUrl)
  }

  function tryNextRecording(failedUrl: string) {
    const index = recordings.findIndex((item) => item.url === failedUrl)
    const next = index >= 0 ? recordings[index + 1] : undefined
    if (next) selectRecording(next.url)
  }

  const value: SongListenContextValue = {
    songNumber,
    recordings,
    selected,
    selectRecording,
    tryNextRecording,
    showList: recordings.length > 1,
  }

  return <SongListenContext.Provider value={value}>{children}</SongListenContext.Provider>
}

export function SongListenTop() {
  const layout = useSongPageLayout()
  const { selected, recordings, selectRecording, tryNextRecording, showList } = useSongListen()

  const selectedBadge = showList ? audioFreshnessBadge(selected) : null
  const title = [selectedBadge, selected.title].filter(Boolean).join(" · ")

  return (
    <div id="listen" className="mb-6 scroll-mt-28">
      <div className="space-y-4">
        {layout === "mobile" ? (
          <AudioRendition
            url={selected.url}
            title={title}
            provider={selected.provider}
            compact
            onPlaybackError={() => tryNextRecording(selected.url)}
          />
        ) : null}
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
        ) : layout === "sidebar" ? (
          <p className="text-sm text-stone-600">Use the player on the right while you explore this song.</p>
        ) : null}
      </div>
    </div>
  )
}

export function SongListenSidebar({ hasMeaning }: { hasMeaning: boolean }) {
  const layout = useSongPageLayout()
  const { selected, tryNextRecording } = useSongListen()

  if (layout !== "sidebar") return null

  const selectedBadge = audioFreshnessBadge(selected)
  const title = [selectedBadge, selected.title].filter(Boolean).join(" · ")

  return (
    <section id="listen-sidebar" className="surface-card scroll-mt-28 p-5 sm:p-6">
      <p className="eyebrow">{selected.isLatest ? "Best recording" : "Listen"}</p>
      <h2 className="mt-2 font-serif text-3xl text-navy-950">Listen to this song</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        Hear the best recording while you explore this song with the AI Companion.
      </p>
      <div className="mt-5">
        <AudioRendition
          url={selected.url}
          title={title}
          provider={selected.provider}
          warmStream
          onPlaybackError={() => tryNextRecording(selected.url)}
        />
      </div>
      <nav aria-label="Return to song text" className="mt-4 flex flex-wrap gap-2">
        <a href="#lyrics" className="soft-chip">
          Lyrics
        </a>
        {hasMeaning ? (
          <a href="#meaning" className="soft-chip">
            Meaning
          </a>
        ) : null}
      </nav>
    </section>
  )
}
