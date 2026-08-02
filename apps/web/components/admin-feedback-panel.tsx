"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import type { AdminFeedbackItem, AdminFeedbackResponse } from "@/lib/member-admin-proxy"
import { readErrorDetail } from "@/lib/read-error-detail"

const filters = [
  ["new", "New"],
  ["reviewed", "Reviewed"],
  ["actioned", "Actioned"],
  ["all", "All"],
] as const

const categoryLabels: Record<string, string> = {
  experience: "Overall experience",
  content: "Lyrics or meaning",
  search: "Search",
  audio_video: "Audio or video",
  ai: "AI response",
  accessibility: "Accessibility",
  other: "Other",
}

export function AdminFeedbackPanel({
  initialStatus = "new",
  initialData,
}: {
  initialStatus?: (typeof filters)[number][0]
  initialData?: AdminFeedbackResponse
}) {
  const [status, setStatus] = useState(initialStatus)
  const [items, setItems] = useState<AdminFeedbackItem[]>(initialData?.items ?? [])
  const [total, setTotal] = useState(initialData?.total ?? 0)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState(initialData?.error ?? "")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [loadedStatus, setLoadedStatus] = useState<string | null>(
    initialData ? initialStatus : null,
  )

  const loadFeedback = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/admin/feedback?status=${encodeURIComponent(status)}`, {
        cache: "no-store",
        credentials: "same-origin",
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, "Could not load feedback"))
        setItems([])
        setTotal(0)
        return
      }
      const payload = body as AdminFeedbackResponse | null
      setItems(payload?.items ?? [])
      setTotal(payload?.total ?? 0)
      setLoadedStatus(status)
    } catch {
      setError("Could not reach the admin service")
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    if (loadedStatus === status) return
    void loadFeedback()
  }, [loadFeedback, loadedStatus, status])

  async function updateStatus(feedbackId: string, nextStatus: "reviewed" | "actioned" | "dismissed") {
    setUpdatingId(feedbackId)
    try {
      const response = await fetch(`/api/admin/feedback?id=${encodeURIComponent(feedbackId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(readErrorDetail(body, "Could not update feedback"))
        return
      }
      setLoadedStatus(null)
      await loadFeedback()
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-ivory-50">
      <header className="border-b border-navy-900/10 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="eyebrow">Admin console</p>
            <h1 className="font-serif text-3xl text-navy-950">User feedback</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/members" className="outline-button px-4 py-2.5">Admins</Link>
            <Link href="/" className="outline-button px-4 py-2.5">Back to site</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {filters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${status === value ? "bg-navy-950 text-white" : "border border-navy-900/10 bg-white text-navy-950 hover:border-gold-500"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm text-stone-600">{loading ? "Loading feedback..." : `${total} submission${total === 1 ? "" : "s"}`}</p>
        {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-5 space-y-4">
          {!loading && !items.length ? (
            <div className="rounded-2xl border border-navy-900/10 bg-white p-8 text-center">
              <p className="font-serif text-2xl text-navy-950">No feedback in this inbox</p>
              <p className="mt-2 text-sm text-stone-600">
                New submissions from the site Feedback button will appear here.
                {status === "new" ? " Try the All tab if you marked items reviewed already." : ""}
              </p>
            </div>
          ) : null}

          {items.map((item) => (
            <article key={item.feedback_id} className="rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-navy-950 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                      {categoryLabels[item.category] ?? item.category}
                    </span>
                    <span className="text-sm font-semibold text-gold-700">{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}</span>
                    {item.priority ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-red-700">Priority</span> : null}
                    <span className="rounded-full bg-ivory-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-600">{item.status}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-navy-950">{item.comment}</p>
                  <p className="mt-3 text-xs text-stone-500">
                    {new Date(item.created_at).toLocaleString()} · ref {item.feedback_id.slice(0, 8)}
                    {item.contact ? ` · ${item.contact}` : ""}
                    {item.page_path ? ` · ${item.page_path}` : ""}
                  </p>
                </div>
              </div>

              {item.status === "new" || item.status === "reviewed" ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-navy-900/10 pt-4">
                  {item.status === "new" ? (
                    <button
                      type="button"
                      disabled={updatingId === item.feedback_id}
                      onClick={() => void updateStatus(item.feedback_id, "reviewed")}
                      className="soft-chip"
                    >
                      Mark reviewed
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={updatingId === item.feedback_id}
                    onClick={() => void updateStatus(item.feedback_id, "actioned")}
                    className="soft-chip"
                  >
                    Mark actioned
                  </button>
                  <button
                    type="button"
                    disabled={updatingId === item.feedback_id}
                    onClick={() => void updateStatus(item.feedback_id, "dismissed")}
                    className="soft-chip"
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
