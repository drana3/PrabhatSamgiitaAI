"use client"

import { useCallback, useEffect, useState } from "react"

import { AdminShell } from "@/components/admin-shell"
import { AdminYoutubeChannelsPanel } from "@/components/admin-youtube-channels-panel"
import { readErrorDetail } from "@/lib/read-error-detail"

type YoutubeReview = {
  id: string
  external_id: string
  title: string
  url: string
  channel_name: string | null
  candidate_song_number: number | null
  title_similarity: number | null
  review_reason: string
  status: string
}

export function AdminYoutubePanel() {
  const [items, setItems] = useState<YoutubeReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [songNumbers, setSongNumbers] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/youtube-reviews?status=pending_review", {
        cache: "no-store",
        credentials: "same-origin",
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, "Could not load YouTube review queue"))
        setItems([])
        return
      }
      setItems((body as { items?: YoutubeReview[] }).items ?? [])
    } catch {
      setError("Could not reach the admin service")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function syncQueue() {
    setNotice("")
    const response = await fetch("/api/admin/youtube-reviews/sync", {
      method: "POST",
      credentials: "same-origin",
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      setError(readErrorDetail(body, "Sync failed"))
      return
    }
    setNotice(`Imported ${(body as { imported?: number }).imported ?? 0} review item(s)`)
    await load()
  }

  async function approve(id: string) {
    const songNumber = Number(songNumbers[id])
    if (!Number.isFinite(songNumber) || songNumber < 1 || songNumber > 5018) {
      setError("Enter a valid song number (1–5018) before approving")
      return
    }
    setError("")
    const response = await fetch(`/api/admin/youtube-reviews/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ song_number: songNumber, is_primary: true }),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      setError(readErrorDetail(body, "Approval failed"))
      return
    }
    setNotice(`Approved video for PS ${songNumber}`)
    await load()
  }

  return (
    <AdminShell
      active="youtube"
      title="YouTube channels & review"
      description="Configure channels to scan, import only new videos, then approve matches in the review queue."
    >
        <AdminYoutubeChannelsPanel />
        <h2 className="mb-4 font-serif text-2xl text-navy-950">Review queue</h2>
        <div className="mb-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => void syncQueue()} className="gold-button px-4 py-2 text-sm">
            Sync from batch output
          </button>
        </div>
        {notice ? <p className="mb-3 text-sm text-emerald-700">{notice}</p> : null}
        {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
        {loading ? <p>Loading review queue…</p> : null}
        {!loading && items.length === 0 ? (
          <p className="text-sm text-stone-600">No pending YouTube videos. Run sync after the batch job.</p>
        ) : null}
        <div className="space-y-4">
          {items.map((item) => (
            <article key={item.id} className="surface-card p-5">
              <h2 className="font-semibold text-navy-950">{item.title}</h2>
              <p className="mt-1 text-xs text-stone-500">
                {item.channel_name ?? "Unknown channel"} · {item.review_reason}
                {item.candidate_song_number ? ` · suggested PS ${item.candidate_song_number}` : ""}
              </p>
              <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-gold-700 underline">
                Open on YouTube
              </a>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-sm">
                  <span className="mb-1 block font-semibold text-navy-950">Song number</span>
                  <input
                    type="number"
                    min={1}
                    max={5018}
                    value={songNumbers[item.id] ?? (item.candidate_song_number ? String(item.candidate_song_number) : "")}
                    onChange={(event) => setSongNumbers((current) => ({ ...current, [item.id]: event.target.value }))}
                    className="w-28 rounded-lg border border-navy-900/10 px-3 py-2"
                  />
                </label>
                <button type="button" onClick={() => void approve(item.id)} className="gold-button px-4 py-2 text-sm">
                  Approve & link
                </button>
              </div>
            </article>
          ))}
        </div>
    </AdminShell>
  )
}
