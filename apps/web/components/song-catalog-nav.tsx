"use client"

import { useRouter } from "next/navigation"
import { useTransition, useState } from "react"

import { adjacentCatalogSongNumber } from "@prabhat/core"

import { songPagePath } from "@/lib/song-path"

function CatalogNavButton({
  target,
  label,
  align,
  pendingTarget,
  busy,
  onNavigate,
}: {
  target: number
  label: string
  align: "left" | "right"
  pendingTarget: number | null
  busy: boolean
  onNavigate: (target: number) => void
}) {
  const showSpinner = busy && pendingTarget === target

  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={showSpinner}
      onClick={() => onNavigate(target)}
      className={`inline-flex min-h-9 min-w-0 items-center justify-center gap-2 rounded-full border border-navy-900/10 bg-white px-3 py-2 shadow-sm transition hover:border-gold-500 hover:text-gold-800 disabled:cursor-wait disabled:opacity-90 ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {showSpinner ? (
        <>
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-gold-200 border-t-gold-700"
          />
          <span>
            {align === "left" ? "← " : ""}PS {target}
            {align === "right" ? " →" : ""}
          </span>
          <span className="sr-only">Loading song {target}</span>
        </>
      ) : (
        label
      )}
    </button>
  )
}

export function SongCatalogNav({ number }: { number: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [pendingTarget, setPendingTarget] = useState<number | null>(null)

  const previous = adjacentCatalogSongNumber(number, -1)
  const next = adjacentCatalogSongNumber(number, 1)
  if (!previous && !next) return null

  const navigate = (target: number) => {
    setPendingTarget(target)
    startTransition(() => {
      router.push(songPagePath(target))
    })
  }

  return (
    <nav
      aria-label="Catalog navigation"
      className="mt-3 flex items-center justify-between gap-3 text-sm font-semibold text-navy-900"
    >
      {previous ? (
        <CatalogNavButton
          target={previous}
          label={`← PS ${previous}`}
          align="left"
          pendingTarget={pendingTarget}
          busy={pending}
          onNavigate={navigate}
        />
      ) : (
        <span className="invisible rounded-full px-3 py-2" aria-hidden>
          ←
        </span>
      )}
      {next ? (
        <CatalogNavButton
          target={next}
          label={`PS ${next} →`}
          align="right"
          pendingTarget={pendingTarget}
          busy={pending}
          onNavigate={navigate}
        />
      ) : (
        <span className="invisible rounded-full px-3 py-2" aria-hidden>
          →
        </span>
      )}
    </nav>
  )
}