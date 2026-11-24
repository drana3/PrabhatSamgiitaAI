"use client"

import { useRouter } from "next/navigation"
import { useTransition, useState } from "react"

import { adjacentCatalogSongNumber } from "@prabhat/core"

import { songPagePath } from "@/lib/song-path"

function CatalogNavButton({
  target,
  direction,
  pendingTarget,
  busy,
  onNavigate,
}: {
  target: number
  direction: "previous" | "next"
  pendingTarget: number | null
  busy: boolean
  onNavigate: (target: number) => void
}) {
  const showSpinner = busy && pendingTarget === target
  const isPrevious = direction === "previous"
  const title = isPrevious ? "Previous" : "Next"

  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={showSpinner}
      aria-label={showSpinner ? `Loading song ${target}` : `${title}, song ${target}`}
      onClick={() => onNavigate(target)}
      className={`group flex min-h-[3.25rem] flex-1 items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-ivory-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:cursor-wait disabled:opacity-80 sm:px-4 ${
        isPrevious ? "justify-start text-left" : "justify-end text-right"
      }`}
    >
      {isPrevious ? (
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-navy-900/10 bg-ivory-50 text-sm font-semibold text-gold-800 group-hover:border-gold-500/40"
        >
          {showSpinner ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold-200 border-t-gold-700" />
          ) : (
            "←"
          )}
        </span>
      ) : null}
      <span className={`flex min-w-0 flex-col gap-0.5 ${isPrevious ? "" : "items-end"}`}>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-navy-950">
          {showSpinner ? "Loading…" : title}
        </span>
        <span className="text-xs font-semibold text-gold-800">Song {target}</span>
      </span>
      {!isPrevious ? (
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-navy-900/10 bg-ivory-50 text-sm font-semibold text-gold-800 group-hover:border-gold-500/40"
        >
          {showSpinner ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold-200 border-t-gold-700" />
          ) : (
            "→"
          )}
        </span>
      ) : null}
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
      className="mt-4 flex items-stretch gap-1 rounded-2xl border border-navy-900/10 bg-white p-1.5 shadow-sm sm:mt-5 sm:gap-2 sm:p-2"
    >
      {previous ? (
        <CatalogNavButton
          target={previous}
          direction="previous"
          pendingTarget={pendingTarget}
          busy={pending}
          onNavigate={navigate}
        />
      ) : (
        <span className="flex-1" aria-hidden />
      )}
      {previous && next ? (
        <div className="w-px shrink-0 self-stretch bg-navy-900/10" aria-hidden />
      ) : null}
      {next ? (
        <CatalogNavButton
          target={next}
          direction="next"
          pendingTarget={pendingTarget}
          busy={pending}
          onNavigate={navigate}
        />
      ) : (
        <span className="flex-1" aria-hidden />
      )}
    </nav>
  )
}