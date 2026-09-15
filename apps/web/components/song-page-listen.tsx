"use client"

import type { RankedAudio } from "@prabhat/core"

import { AudioRendition } from "@/components/audio-rendition"
import { SongListenPanel } from "@/components/song-listen-panel"
import { useSongPageLayout } from "@/lib/use-song-page-layout"

export function SongListenMobile({
  songNumber,
  recordings,
}: {
  songNumber: number
  recordings: RankedAudio[]
}) {
  const layout = useSongPageLayout()
  if (layout !== "mobile") return null

  return (
    <div id="listen" className="mb-6 scroll-mt-28">
      <SongListenPanel songNumber={songNumber} recordings={recordings} compact />
    </div>
  )
}

export function SongListenSidebar({
  recordings,
  hasMeaning,
}: {
  recordings: RankedAudio[]
  hasMeaning: boolean
}) {
  const layout = useSongPageLayout()
  if (layout !== "sidebar") return null

  const best = recordings.find((item) => item.isLatest) ?? recordings[0]
  if (!best) return null

  const title = best.isLatest ? `Best · ${best.title}` : best.title

  return (
    <section id="listen-sidebar" className="surface-card scroll-mt-28 p-5 sm:p-6">
      <p className="eyebrow">{best.isLatest ? "Best recording" : "Listen"}</p>
      <h2 className="mt-2 font-serif text-3xl text-navy-950">Listen to this song</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        Hear the best recording while you explore this song with the AI Companion.
      </p>
      <div className="mt-5">
        <AudioRendition
          url={best.url}
          title={title}
          provider={best.provider}
          warmStream
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
