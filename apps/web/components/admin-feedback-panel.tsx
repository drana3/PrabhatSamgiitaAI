"use client"

import { useCallback, useEffect, useState } from "react"

import { AdminShell } from "@/components/admin-shell"
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
  // Server-side loads can fail (missing Easy Auth headers during RSC) even when
  // the signed-in admin can load feedback from the browser. Only treat a clean
  // payload as already loaded so the client can retry.
  const hasUsableInitial = Boolean(initialData && !initialData.error)
  const [status, setStatus] = useState(initialStatus)
  const [items, setItems] = useState<AdminFeedbackItem[]>(hasUsableInitial ? initialData!.items : [])
  const [total, setTotal] = useState(hasUsableInitial ? initialData!.total : 0)
  const [loading, setLoading] = useState(!hasUsableInitial)
  const [error, setError] = useState(initialData?.error ?? "")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const [loadedStatus, setLoadedStatus] = useState<string | null>(
    hasUsableInitial ? initialStatus : null,
  )

  const MIN_LIVE_QUOTE_LENGTH = 8

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
        setError(readErrorDetail(body, `Could not load feedback (${response.status})`))
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

  async function patchFeedback(
    feedbackId: string,
    body: {
      status?: "reviewed" | "actioned" | "dismissed"
      publish_to_live?: boolean
      unpublish_from_live?: boolean
    },
  ) {
    setUpdatingId(feedbackId)
    setError("")
    setNotice("")
    try {
      const response = await fetch(`/api/admin/feedback?id=${encodeURIComponent(feedbackId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setError(readErrorDetail(payload, "Could not update feedback"))
        return
      }
      if (body.publish_to_live) {
        setNotice("Published to the live ticker. Refresh the home page to see it scroll.")
      } else if (body.unpublish_from_live) {
        setNotice("Removed from the live ticker.")
      }
      setLoadedStatus(null)
      await loadFeedback()
    } catch {
      setError("Could not reach the admin service")
    } finally {
      setUpdatingId(null)
    }
  }

  async function updateStatus(feedbackId: string, nextStatus: "reviewed" | "actioned" | "dismissed") {
    await patchFeedback(feedbackId, { status: nextStatus })
  }

  return (
    <AdminShell
      active="feedback"
      title="User feedback"
      description="Review submissions from the site feedback widget and publish selected quotes to the home ticker."
    >
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
        {notice ? (
          <p className="mt-3 text-sm text-emerald-800" role="status">{notice}</p>
        ) : null}
        {error ? (
          <div className="mt-3 flex flex-wrap items-center gap-3" role="alert">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoadedStatus(null)
                void loadFeedback()
              }}
              className="text-sm font-semibold text-gold-700 underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        ) : null}

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
                    {item.on_live_ticker ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800">
                        On live ticker
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-navy-950">{item.comment}</p>
                  <p className="mt-3 text-xs text-stone-500">
                    {new Date(item.created_at).toLocaleString()} · ref {item.feedback_id.slice(0, 8)}
                    {item.contact ? ` · ${item.contact}` : ""}
                    {item.page_path ? ` · ${item.page_path}` : ""}
                  </p>
                </div>
              </div>

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
                {item.status === "new" || item.status === "reviewed" ? (
                  <>
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
                  </>
                ) : null}
                {item.on_live_ticker ? (
                  <button
                    type="button"
                    disabled={updatingId === item.feedback_id}
                    onClick={() => void patchFeedback(item.feedback_id, { unpublish_from_live: true })}
                    className="soft-chip"
                  >
                    Remove from live ticker
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={updatingId === item.feedback_id}
                    title={
                      item.comment.trim().length < MIN_LIVE_QUOTE_LENGTH
                        ? `Needs at least ${MIN_LIVE_QUOTE_LENGTH} characters`
                        : "Publish this comment on the home-page ticker"
                    }
                    onClick={() => {
                      if (item.comment.trim().length < MIN_LIVE_QUOTE_LENGTH) {
                        setNotice("")
                        setError(
                          `Comment needs at least ${MIN_LIVE_QUOTE_LENGTH} characters to show on the live ticker.`,
                        )
                        return
                      }
                      void patchFeedback(item.feedback_id, { publish_to_live: true })
                    }}
                    className="gold-button px-4 py-2 text-xs"
                  >
                    Show on live ticker
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
    </AdminShell>
  )
}
