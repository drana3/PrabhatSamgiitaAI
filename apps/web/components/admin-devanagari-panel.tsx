"use client"

import { useEffect, useState } from "react"

import { AdminShell } from "@/components/admin-shell"
import { CopyTextButton } from "@/components/copy-text-button"

type DevanagariSong = {
  song_number: number
  title: string
  lyrics_original: string | null
  lyrics_devanagari: string | null
  devanagari_status: string
  line_count_roman: number
  line_count_devanagari: number
}

export function AdminDevanagariPanel({
  initialSongNumber,
}: {
  initialSongNumber?: string
}) {
  const [songNumber, setSongNumber] = useState(initialSongNumber || "1")
  const [song, setSong] = useState<DevanagariSong | null>(null)
  const [draft, setDraft] = useState("")
  const [note, setNote] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function loadSong(number = songNumber) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/devanagari/${encodeURIComponent(number)}`, {
        cache: "no-store",
        credentials: "same-origin",
      })
      const body = (await response.json()) as DevanagariSong & { detail?: string }
      if (!response.ok) {
        throw new Error(body.detail || "Failed to load song")
      }
      setSong(body)
      setDraft(body.lyrics_devanagari || "")
      setMessage(`Loaded song #${body.song_number} · status: ${body.devanagari_status}`)
    } catch (err) {
      setSong(null)
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (initialSongNumber) {
      void loadSong(initialSongNumber)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once from query
  }, [initialSongNumber])

  async function save(submitForApproval: boolean) {
    if (!song) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/devanagari/${song.song_number}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lyrics_devanagari: draft,
          submit_for_approval: submitForApproval,
          review_note: note || null,
        }),
      })
      const body = (await response.json()) as DevanagariSong & { detail?: string }
      if (!response.ok) throw new Error(body.detail || "Save failed")
      setSong(body)
      setDraft(body.lyrics_devanagari || "")
      setMessage(
        submitForApproval
          ? "Saved and submitted for approval (pending_review)"
          : "Saved as provisional",
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setBusy(false)
    }
  }

  async function approve() {
    if (!song) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/devanagari/${song.song_number}/approve`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_note: note || null }),
      })
      const body = (await response.json()) as DevanagariSong & { detail?: string }
      if (!response.ok) throw new Error(body.detail || "Approve failed")
      setSong(body)
      setMessage("Approved — apps will show status: Approved")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed")
    } finally {
      setBusy(false)
    }
  }

  const roman = song?.lyrics_original?.trim() || ""

  return (
    <AdminShell
      active="devanagari"
      title="Devanagari review"
      description="Roman (left) + editable Devanagari (right). Copy → edit externally → paste back → Save / Approve."
    >
      <section className="rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-navy-950">
            Song number
            <input
              value={songNumber}
              onChange={(e) => setSongNumber(e.target.value)}
              className="mt-2 block w-40 rounded-xl border border-navy-900/10 bg-ivory-50 px-4 py-3 text-sm outline-none focus:border-gold-500"
              inputMode="numeric"
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadSong()
              }}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void loadSong()}
            className="rounded-full bg-navy-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Load song
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-emerald-800">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </section>

      {song ? (
        <section className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                Song #{song.song_number}
              </p>
              <h2 className="font-serif text-2xl text-navy-950">{song.title}</h2>
              <p className="mt-1 text-sm text-stone-600">
                Status: <span className="font-semibold">{song.devanagari_status}</span>
                {" · "}
                Roman lines {song.line_count_roman} · Devanagari lines{" "}
                {draft.trim() ? draft.trim().split("\n").length : 0}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-navy-900/10 bg-ivory-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy-950">Roman (read-only)</p>
                <CopyTextButton text={roman} label="Copy Roman" compact />
              </div>
              <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap font-serif text-base leading-7 text-navy-950 select-text">
                {roman || "—"}
              </pre>
            </div>
            <div className="rounded-2xl border border-navy-900/10 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy-950">Devanagari (editable)</p>
                <CopyTextButton text={draft} label="Copy Devanagari" compact />
              </div>
              <p className="mt-1 text-xs text-stone-500">
                Copy → edit in another app → paste back here.
              </p>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={18}
                spellCheck={false}
                className="mt-3 w-full rounded-xl border border-navy-900/10 bg-ivory-50 px-4 py-3 font-serif text-base leading-7 text-navy-950 outline-none focus:border-gold-500"
              />
            </div>
          </div>

          <label className="block text-sm font-semibold text-navy-950">
            Review note (optional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-2 w-full rounded-xl border border-navy-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-gold-500"
              placeholder="Why this change?"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(false)}
              className="rounded-full border border-navy-900/15 bg-white px-5 py-3 text-sm font-semibold text-navy-950 disabled:opacity-50"
            >
              Save provisional
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(true)}
              className="rounded-full border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-950 disabled:opacity-50"
            >
              Submit for approval
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void approve()}
              className="rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Approve
            </button>
          </div>
        </section>
      ) : null}
    </AdminShell>
  )
}
