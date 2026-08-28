"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  hasPublishedLearnerSargam,
  HARMONIUM_GATE_ACTION_GUEST,
  HARMONIUM_GATE_ACTION_PROFILE,
  HARMONIUM_GATE_BODY_GUEST,
  HARMONIUM_GATE_BODY_SIGNED_IN,
  HARMONIUM_GATE_TITLE,
} from "@prabhat/core"

import { useMember } from "@/components/member-provider"
import { HarmoniumPractice } from "@/components/harmonium-practice"
import type { TransposedNotation } from "@/lib/api"
import { useHarmoniumPracticeEnabled } from "@/lib/harmonium-practice-pref"
import { signInHref } from "@/lib/sign-in"

export function HarmoniumNavLink({
  songNumber,
  sourceStatus,
  notationEnabled,
}: {
  songNumber: number
  sourceStatus?: string | null
  notationEnabled?: boolean | null
}) {
  const enabled = useHarmoniumPracticeEnabled()
  if (!enabled) return null
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

function HarmoniumPracticeGate() {
  const { session } = useMember()
  const pathname = usePathname()
  const signedIn = session.authenticated

  return (
    <section
      id="notation"
      className="scroll-mt-28 rounded-2xl border border-gold-500/25 bg-gold-50/70 p-5 sm:p-6"
    >
      <p className="eyebrow">Optional learning studio</p>
      <h2 className="mt-2 font-serif text-3xl text-navy-950">{HARMONIUM_GATE_TITLE}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
        {signedIn ? HARMONIUM_GATE_BODY_SIGNED_IN : HARMONIUM_GATE_BODY_GUEST}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        {signedIn ? (
          <Link href="/account#harmonium-practice" className="gold-button px-5 py-3 text-sm">
            {HARMONIUM_GATE_ACTION_PROFILE}
          </Link>
        ) : (
          <Link href={signInHref(pathname)} className="gold-button px-5 py-3 text-sm">
            {HARMONIUM_GATE_ACTION_GUEST}
          </Link>
        )}
        <Link href="/account#harmonium-practice" className="outline-button px-5 py-3 text-sm">
          Learn more
        </Link>
      </div>
    </section>
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
  const enabled = useHarmoniumPracticeEnabled()
  if (!hasPublishedLearnerSargam(songNumber, sourceStatus, notationEnabled)) return null

  return (
    <div className="mt-7 border-t border-navy-900/10 pt-7">
      {enabled ? (
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
      ) : (
        <HarmoniumPracticeGate />
      )}
    </div>
  )
}
