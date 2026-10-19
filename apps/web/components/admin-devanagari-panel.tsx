"use client"

import { useEffect, useRef, useState } from "react"

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
  song_language?: string | null
  review_language?: string | null
  conversion_confidence_percent?: number | null
  conversion_notes?: string | null
  regional_grammar_notes?: string | null
  review_reasons?: string[]
  ambiguous_tokens?: string[]
  unsupported_tokens?: string[]
}

type ProgressKind = "load" | "save" | "submit" | "approve"

const PROGRESS_STEPS: Record<ProgressKind, { eyebrow: string; steps: readonly string[] }> = {
  load: {
    eyebrow: "Loading song",
    steps: [
      "Loading song…",
      "Fetching Roman lyrics…",
      "Loading Devanagari lyrics…",
      "Preparing review workspace…",
    ],
  },
  save: {
    eyebrow: "Saving provisional",
    steps: [
      "Validating Devanagari draft…",
      "Saving Roman + Devanagari…",
      "Updating review status…",
      "Confirming provisional save…",
    ],
  },
  submit: {
    eyebrow: "Submitting for approval",
    steps: [
      "Validating Devanagari draft…",
      "Saving latest lyrics…",
      "Queuing for approval…",
      "Marking pending review…",
    ],
  },
  approve: {
    eyebrow: "Approving Devanagari",
    steps: [
      "Checking review status…",
      "Approving Devanagari lyrics…",
      "Publishing to apps…",
      "Confirming approved status…",
    ],
  },
}

function ActionProgress({
  kind,
  stepIndex,
  songLabel,
  className = "mt-6",
}: {
  kind: ProgressKind
  stepIndex: number
  songLabel: string
  className?: string
}) {
  const { eyebrow, steps } = PROGRESS_STEPS[kind]
  const clamped = Math.min(Math.max(stepIndex, 0), steps.length - 1)
  const percent = Math.round(((clamped + 1) / steps.length) * 100)

  return (
    <section
      className={`rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm ${className}`}
      aria-busy="true"
      aria-live="polite"
    >
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">{eyebrow}</p>
      <h2 className="mt-1 font-serif text-xl text-navy-950">{songLabel}</h2>
      <p className="mt-3 text-sm font-semibold text-navy-900">{steps[clamped]}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-navy-900/10">
        <div
          className="h-full rounded-full bg-gold-500 transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ol className="mt-4 space-y-2">
        {steps.map((label, index) => {
          const done = index < clamped
          const active = index === clamped
          return (
            <li
              key={label}
              className={`flex items-center gap-2 text-sm ${
                done ? "text-emerald-800" : active ? "font-semibold text-navy-950" : "text-stone-400"
              }`}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                  done
                    ? "bg-emerald-100 text-emerald-800"
                    : active
                      ? "bg-gold-100 text-gold-900"
                      : "bg-stone-100 text-stone-400"
                }`}
                aria-hidden
              >
                {done ? "✓" : index + 1}
              </span>
              {label}
            </li>
          )
        })}
      </ol>
    </section>
  )
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
  const [progressKind, setProgressKind] = useState<ProgressKind | null>(
    initialSongNumber ? "load" : null,
  )
  const [progressStep, setProgressStep] = useState(0)
  const progressTimers = useRef<number[]>([])

  function clearProgressTimers() {
    for (const id of progressTimers.current) window.clearTimeout(id)
    progressTimers.current = []
  }

  function startProgress(kind: ProgressKind) {
    clearProgressTimers()
    setProgressKind(kind)
    setProgressStep(0)
    const steps = PROGRESS_STEPS[kind].steps
    steps.forEach((_, index) => {
      if (index === 0) return
      const id = window.setTimeout(() => setProgressStep(index), index * 400)
      progressTimers.current.push(id)
    })
  }

  function finishProgress(kind: ProgressKind) {
    clearProgressTimers()
    setProgressStep(PROGRESS_STEPS[kind].steps.length - 1)
  }

  async function endProgress(holdMs = 0) {
    if (holdMs > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, holdMs))
    }
    clearProgressTimers()
    setProgressKind(null)
    setProgressStep(0)
  }

  async function loadSong(number = songNumber) {
    setBusy(true)
    setSong(null)
    setError(null)
    setMessage(null)
    startProgress("load")
    try {
      const response = await fetch(`/api/admin/devanagari/${encodeURIComponent(number)}`, {
        cache: "no-store",
        credentials: "same-origin",
      })
      const body = (await response.json()) as DevanagariSong & { detail?: string }
      if (!response.ok) {
        throw new Error(body.detail || "Failed to load song")
      }
      finishProgress("load")
      setSong(body)
      setDraft(body.lyrics_devanagari || "")
      setMessage(`Loaded song #${body.song_number} · status: ${body.devanagari_status}`)
      await endProgress(320)
    } catch (err) {
      setSong(null)
      setError(err instanceof Error ? err.message : "Failed to load")
      await endProgress()
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (initialSongNumber) {
      void loadSong(initialSongNumber)
    }
    return () => clearProgressTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once from query
  }, [initialSongNumber])

  async function save(submitForApproval: boolean) {
    if (!song) return
    const kind: ProgressKind = submitForApproval ? "submit" : "save"
    setBusy(true)
    setError(null)
    setMessage(null)
    startProgress(kind)
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
      finishProgress(kind)
      setSong(body)
      setDraft(body.lyrics_devanagari || "")
      setMessage(
        submitForApproval
          ? "Saved and submitted for approval (pending_review)"
          : "Saved as provisional",
      )
      await endProgress(320)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
      await endProgress()
    } finally {
      setBusy(false)
    }
  }

  async function approve() {
    if (!song) return
    if (!draft.trim()) {
      setError("Devanagari text is required before approve")
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    startProgress("approve")
    try {
      // Always send the editor draft — Approve used to flip status only and drop unsaved edits.
      const response = await fetch(`/api/admin/devanagari/${song.song_number}/approve`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_note: note || null,
          lyrics_devanagari: draft,
        }),
      })
      const body = (await response.json()) as DevanagariSong & { detail?: string }
      if (!response.ok) throw new Error(body.detail || "Approve failed")
      finishProgress("approve")
      setSong(body)
      setDraft(body.lyrics_devanagari || "")
      setMessage("Approved — apps will show status: Approved")
      await endProgress(320)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed")
      await endProgress()
    } finally {
      setBusy(false)
    }
  }

  const roman = song?.lyrics_original?.trim() || ""
  const loading = progressKind === "load"
  const progressLabel = song
    ? `Song #${song.song_number}`
    : songNumber.trim()
      ? `Song #${songNumber.trim()}`
      : "Devanagari review"

  return (
    <AdminShell
      active="devanagari"
      title="Devanagari review"
      description="Roman (left) + editable Devanagari (right). Copy → edit in App/Other Tool → paste back → Save / Approve."
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
            disabled={busy || loading}
            onClick={() => void loadSong()}
            className="rounded-full bg-navy-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load song"}
          </button>
        </div>
        {message && !progressKind ? <p className="mt-3 text-sm text-emerald-800">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </section>

      {loading && progressKind === "load" ? (
        <ActionProgress kind="load" stepIndex={progressStep} songLabel={progressLabel} />
      ) : null}

      {!loading && song ? (
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
              {song.conversion_confidence_percent != null ? (
                <p className="mt-2 rounded-xl border border-gold-500/25 bg-gold-50 px-3 py-2 text-sm text-navy-900">
                  <span className="font-semibold">
                    Roman→Devanagari confidence: {song.conversion_confidence_percent}%
                  </span>
                  {song.song_language ? ` · ${song.song_language}` : ""}
                  {song.review_language ? ` · agent: ${song.review_language}` : ""}
                  {song.conversion_notes ? (
                    <span className="mt-1 block text-xs text-stone-600">{song.conversion_notes}</span>
                  ) : null}
                  {song.regional_grammar_notes ? (
                    <span className="mt-1 block text-xs text-stone-600">
                      Regional grammar: {song.regional_grammar_notes}
                    </span>
                  ) : null}
                  {song.review_reasons?.length ? (
                    <span className="mt-2 block text-xs text-stone-700">
                      Review reasons:
                      <ul className="mt-1 list-disc pl-4">
                        {song.review_reasons.slice(0, 8).map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </span>
                  ) : null}
                  {song.ambiguous_tokens?.length ? (
                    <span className="mt-1 block text-xs text-amber-800">
                      Ambiguous: {song.ambiguous_tokens.slice(0, 12).join(", ")}
                    </span>
                  ) : null}
                  {song.unsupported_tokens?.length ? (
                    <span className="mt-1 block text-xs text-red-700">
                      Unsupported: {song.unsupported_tokens.slice(0, 12).join(", ")}
                    </span>
                  ) : null}
                </p>
              ) : null}
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
                Copy → edit in App/Other Tool → paste back here.
              </p>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={18}
                spellCheck={false}
                disabled={busy}
                className="mt-3 w-full rounded-xl border border-navy-900/10 bg-ivory-50 px-4 py-3 font-serif text-base leading-7 text-navy-950 outline-none focus:border-gold-500 disabled:opacity-60"
              />
            </div>
          </div>

          <label className="block text-sm font-semibold text-navy-950">
            Review note (optional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
              className="mt-2 w-full rounded-xl border border-navy-900/10 bg-white px-4 py-3 text-sm outline-none focus:border-gold-500 disabled:opacity-60"
              placeholder="Why this change?"
            />
          </label>

          {progressKind && progressKind !== "load" ? (
            <ActionProgress
              kind={progressKind}
              stepIndex={progressStep}
              songLabel={progressLabel}
              className="mt-2"
            />
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(false)}
              className="rounded-full border border-navy-900/15 bg-white px-5 py-3 text-sm font-semibold text-navy-950 disabled:opacity-50"
            >
              {progressKind === "save" ? "Saving…" : "Save provisional"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(true)}
              className="rounded-full border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-950 disabled:opacity-50"
            >
              {progressKind === "submit" ? "Submitting…" : "Submit for approval"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void approve()}
              className="rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {progressKind === "approve" ? "Approving…" : "Approve"}
            </button>
          </div>
        </section>
      ) : null}
    </AdminShell>
  )
}
