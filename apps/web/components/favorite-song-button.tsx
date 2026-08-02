"use client"

import Link from "next/link"
import { useState, type MouseEvent } from "react"

import { useMember } from "@/components/member-provider"
import { addFavoriteSong, removeFavoriteSong } from "@/lib/member"
import { signInHref } from "@/lib/sign-in"
import { songPagePath } from "@/lib/song-path"

export function FavoriteSongButton({ songNumber }: { songNumber: number }) {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"
  const { loading, session, refresh } = useMember()
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  if (!authEnabled) return null
  if (loading) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-28 animate-pulse rounded-full border border-white/20 bg-white/10"
      />
    )
  }

  if (!session.authenticated) {
    return (
      <Link
        href={signInHref(songPagePath(songNumber))}
        className="whitespace-nowrap rounded-full border border-white/30 bg-navy-950/35 px-4 py-2 text-sm font-semibold text-white transition hover:border-gold-300 hover:bg-white/10"
      >
        ♡ Save song
      </Link>
    )
  }

  const saved = (session.favorite_song_numbers ?? []).includes(songNumber)
  const backendReady = session.member_backend !== false

  async function toggleFavorite(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    setNotice(null)
    if (!backendReady) {
      setNotice("Playlist saving is temporarily unavailable. Please try again shortly.")
      return
    }
    setPending(true)
    try {
      const result = saved
        ? await removeFavoriteSong(songNumber)
        : await addFavoriteSong(songNumber)
      if (!result.ok) {
        setNotice(
          result.error === "Sign in is required" || result.error === "Member proxy authentication failed"
            ? "Please sign in again to update your playlist."
            : result.error === "Member services are not configured"
              ? "Playlist saving is temporarily unavailable. Please try again shortly."
              : result.error,
        )
        return
      }
      await refresh({ silent: true })
      setNotice(saved ? "Removed from your playlist." : "Saved to your playlist.")
      window.setTimeout(() => setNotice(null), 2200)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-pressed={saved}
        aria-label={saved ? "Remove from playlist" : "Save to playlist"}
        disabled={pending}
        onClick={(event) => void toggleFavorite(event)}
        data-feature="save_song"
        className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
          saved
            ? "border-gold-300 bg-gold-300 text-navy-950 hover:bg-gold-200"
            : "border-white/30 bg-navy-950/35 text-white hover:border-gold-300 hover:bg-white/10"
        }`}
      >
        {pending ? "Saving…" : saved ? "♥ Saved" : "♡ Save song"}
      </button>
      {notice ? (
        <p role="status" className="absolute right-0 top-12 z-30 min-w-[12rem] rounded-xl border border-navy-900/10 bg-white px-3 py-2 text-xs font-semibold text-navy-950 shadow-lg">
          {notice}
        </p>
      ) : null}
    </div>
  )
}
