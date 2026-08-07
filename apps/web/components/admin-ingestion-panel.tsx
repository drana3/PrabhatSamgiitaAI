"use client"

import { useState } from "react"

import { AdminNav } from "@/components/admin-nav"
import { localeOptions } from "@/lib/languages"
import { readErrorDetail } from "@/lib/read-error-detail"

type Preview = {
  song_number: number
  existing_lyrics: string | null
  existing_meanings: Record<string, string>
  existing_audio_url: string | null
  existing_video_url: string | null
  existing_notation: string | null
}

export function AdminIngestionPanel({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const [songNumber, setSongNumber] = useState("1")
  const [preview, setPreview] = useState<Preview | null>(null)
  const [lyrics, setLyrics] = useState("")
  const [meaningLanguage, setMeaningLanguage] = useState("en")
  const [meaningText, setMeaningText] = useState("")
  const [meaningPrimary, setMeaningPrimary] = useState(true)
  const [audioUrl, setAudioUrl] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [notation, setNotation] = useState("")
  const [comments, setComments] = useState("")
  const [languageCheck, setLanguageCheck] = useState("")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState<Array<{ id: string; song_number: number; status: string }>>([])

  async function loadPreview() {
    setError("")
    const number = Number(songNumber)
    const response = await fetch(`/api/admin/ingestions/preview?song_number=${number}`, {
      credentials: "same-origin",
      cache: "no-store",
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      setError(readErrorDetail(body, "Could not load song preview"))
      return
    }
    const data = body as Preview
    setPreview(data)
    if (!lyrics && data.existing_lyrics) setLyrics(data.existing_lyrics)
    if (!meaningText && data.existing_meanings[meaningLanguage]) {
      setMeaningText(data.existing_meanings[meaningLanguage])
    }
    if (!audioUrl && data.existing_audio_url) setAudioUrl(data.existing_audio_url)
    if (!videoUrl && data.existing_video_url) setVideoUrl(data.existing_video_url)
    if (!notation && data.existing_notation) setNotation(data.existing_notation)
  }

  async function checkLanguage() {
    setLanguageCheck("")
    const response = await fetch("/api/admin/ingestions/check-language", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: meaningLanguage, text: meaningText }),
    })
    const body = await response.json().catch(() => null) as { ok?: boolean; message?: string } | null
    setLanguageCheck(body?.ok ? "Language check passed" : (body?.message ?? "Language check failed"))
  }

  async function submit(allowWarnings = false) {
    setError("")
    setNotice("")
    const number = Number(songNumber)
    const payload = {
      song_number: number,
      lyrics: lyrics.trim() || null,
      meanings: meaningText.trim()
        ? [{ language: meaningLanguage, text: meaningText.trim(), is_primary: meaningPrimary }]
        : [],
      audio: audioUrl.trim() ? { kind: "audio", url: audioUrl.trim(), is_primary: true } : null,
      video: videoUrl.trim() ? { kind: "video", url: videoUrl.trim(), is_primary: true } : null,
      notation_text: notation.trim() || null,
      notation_is_primary: Boolean(notation.trim()),
      comments: comments.trim() || null,
    }
    const response = await fetch(
      `/api/admin/ingestions${allowWarnings ? "?allow_warnings=true" : ""}`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    )
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      const detail = body as { detail?: { warnings?: string[]; message?: string } | string } | null
      if (detail && typeof detail.detail === "object" && detail.detail.warnings?.length) {
        setError(`${detail.detail.message ?? "Language warnings"}: ${detail.detail.warnings.join("; ")}`)
        return
      }
      setError(readErrorDetail(body, "Submission failed"))
      return
    }
    setNotice("Submitted for super-admin approval")
  }

  async function loadPending() {
    if (!isSuperAdmin) return
    const response = await fetch("/api/admin/ingestions?status=pending_super_admin", {
      credentials: "same-origin",
      cache: "no-store",
    })
    const body = await response.json().catch(() => null)
    if (response.ok) {
      setPending((body as { items?: Array<{ id: string; song_number: number; status: string }> }).items ?? [])
    }
  }

  async function review(id: string, approve: boolean) {
    const response = await fetch(`/api/admin/ingestions/${encodeURIComponent(id)}/review`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve }),
    })
    if (!response.ok) {
      setError(readErrorDetail(await response.json().catch(() => null), "Review failed"))
      return
    }
    setNotice(approve ? "Submission approved and applied" : "Submission rejected")
    await loadPending()
  }

  return (
    <main className="min-h-screen bg-ivory-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">Admin</p>
        <h1 className="mt-2 font-serif text-4xl text-navy-950">Song ingestion</h1>
        <p className="mt-2 text-sm text-stone-600">
          Submit lyrics, meanings, audio, video, and notation. Entries stay pending until a super-admin approves.
        </p>
        <AdminNav active="ingest" />
        {notice ? <p className="mb-3 text-sm text-emerald-700">{notice}</p> : null}
        {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
        <div className="surface-card space-y-4 p-5">
          <label className="block text-sm">
            <span className="font-semibold text-navy-950">Song number (1–5018)</span>
            <input
              type="number"
              min={1}
              max={5018}
              value={songNumber}
              onChange={(event) => setSongNumber(event.target.value)}
              className="mt-1 w-full rounded-lg border border-navy-900/10 px-3 py-2"
            />
          </label>
          <button type="button" onClick={() => void loadPreview()} className="outline-button text-sm">
            Load existing DB content
          </button>
          {preview ? (
            <p className="text-xs text-stone-500">
              DB has {Object.keys(preview.existing_meanings).length} meaning language(s)
              {preview.existing_audio_url ? " · audio" : ""}
              {preview.existing_video_url ? " · video" : ""}
            </p>
          ) : null}
          <label className="block text-sm">
            <span className="font-semibold text-navy-950">Lyrics</span>
            <textarea value={lyrics} onChange={(event) => setLyrics(event.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-navy-900/10 px-3 py-2" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-semibold text-navy-950">Meaning language</span>
              <select value={meaningLanguage} onChange={(event) => setMeaningLanguage(event.target.value)} className="mt-1 w-full rounded-lg border border-navy-900/10 px-3 py-2">
                {localeOptions.map((option) => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm pt-6">
              <input type="checkbox" checked={meaningPrimary} onChange={(event) => setMeaningPrimary(event.target.checked)} />
              Primary for this language
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-semibold text-navy-950">Meaning</span>
            <textarea value={meaningText} onChange={(event) => setMeaningText(event.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-navy-900/10 px-3 py-2" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void checkLanguage()} className="outline-button text-sm">Check language</button>
            {languageCheck ? <span className="text-xs text-stone-600">{languageCheck}</span> : null}
          </div>
          <label className="block text-sm">
            <span className="font-semibold text-navy-950">Audio URL (optional)</span>
            <input value={audioUrl} onChange={(event) => setAudioUrl(event.target.value)} className="mt-1 w-full rounded-lg border border-navy-900/10 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-navy-950">Video URL (optional)</span>
            <input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} className="mt-1 w-full rounded-lg border border-navy-900/10 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-navy-950">Notation (optional)</span>
            <textarea value={notation} onChange={(event) => setNotation(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-navy-900/10 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-navy-950">Comments</span>
            <textarea value={comments} onChange={(event) => setComments(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-navy-900/10 px-3 py-2" />
          </label>
          <button type="button" onClick={() => void submit()} className="gold-button px-4 py-2 text-sm">
            Submit for super-admin approval
          </button>
        </div>
        {isSuperAdmin ? (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-2xl text-navy-950">Pending approvals</h2>
              <button type="button" onClick={() => void loadPending()} className="outline-button text-sm">Refresh</button>
            </div>
            {pending.length === 0 ? <p className="text-sm text-stone-600">No pending submissions.</p> : null}
            <div className="space-y-3">
              {pending.map((item) => (
                <div key={item.id} className="surface-card flex items-center justify-between gap-3 p-4">
                  <p className="text-sm font-semibold text-navy-950">PS {item.song_number}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void review(item.id, true)} className="gold-button px-3 py-1.5 text-xs">Approve</button>
                    <button type="button" onClick={() => void review(item.id, false)} className="outline-button px-3 py-1.5 text-xs">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
