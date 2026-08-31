"use client"

import {
  hasPublishedLearnerSargam,
} from "@prabhat/core"

import { HarmoniumPractice } from "@/components/harmonium-practice"
import type { TransposedNotation } from "@/lib/api"

export function HarmoniumNavLink({
  songNumber,
  sourceStatus,
  notationEnabled,
}: {
  songNumber: number
  sourceStatus?: string | null
  notationEnabled?: boolean | null
}) {
  if (!hasPublishedLearnerSargam(songNumber, sourceStatus, notationEnabled)) return null
  return (
    <a
      href="#notation"
      className="shrink-0 whitespace-nowrap rounded-full border border-white/30 bg-navy-950/35 px-3.5 py-2 text-xs font-semibold text-white sm:px-4 sm:text-sm"
    >
      ♬ Harmonium
    </a>
  )
}

export function HarmoniumPracticeSection({
  songNumber,
  initialNotation = null,
  sourceUrl,
  sourceStatus,
  songLyricLines,
  originalLyricLines,
  songTitle,
  attribution,
  notationEnabled,
}: {
  songNumber: number
  initialNotation?: TransposedNotation | null
  sourceUrl?: string | null
  sourceStatus?: string | null
  songLyricLines?: string[]
  originalLyricLines?: string[]
  songTitle?: string
  attribution?: { display_name: string; submitted_at?: string | null } | null
  notationEnabled?: boolean | null
}) {
  if (!hasPublishedLearnerSargam(songNumber, sourceStatus, notationEnabled)) return null

  return (
    <div className="mt-7 border-t border-navy-900/10 pt-7">
      <HarmoniumPractice
        songNumber={songNumber}
        initialNotation={initialNotation}
        sourceUrl={sourceUrl}
        sourceStatus={sourceStatus}
        songLyricLines={songLyricLines}
        originalLyricLines={originalLyricLines}
        songTitle={songTitle}
        attribution={attribution}
      />
    </div>
  )
}
