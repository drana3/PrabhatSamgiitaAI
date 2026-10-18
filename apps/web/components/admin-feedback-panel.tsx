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
  devanagari: "Devanagari lyrics",
  other: "Other",
}

function songNumberFromFeedback(item: AdminFeedbackItem): number | null {
  const fromPath = item.page_path?.match(/\/songs?\/(\d+)/i)
  if (fromPath) return Number(fromPath[1])
  const fromComment = item.comment.match(/song\s*#(\d+)/i)
  if (fromComment) return Number(fromComment[1])
  return null
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
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [replyingId, setReplyingId] = useState<string | null>(null)
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

  async function sendReply(feedbackId: string) {
    const body = (replyDrafts[feedbackId] || "").trim()
    if (body.length < 1) {
      setError("Write a reply before sending.")
      return
    }
    setReplyingId(feedbackId)
    setError("")
    setNotice("")
    try {
      const response = await fetch(`/api/admin/feedback/${encodeURIComponent(feedbackId)}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ body }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(payload, "Could not send reply"))
        return
      }
      const updated = payload as AdminFeedbackItem
      setItems((prev) => prev.map((item) => (item.feedback_id === feedbackId ? { ...item, ...updated } : item)))
      setReplyDrafts((prev) => ({ ...prev, [feedbackId]: "" }))
      const last = updated.replies?.[updated.replies.length - 1]
      setNotice(
        last?.email_delivered
          ? "Reply sent and emailed to the user."
          : updated.contact
            ? "Reply saved. Email could not be delivered (check ACS email config)."
            : "Reply saved. No contact email on this feedback — user was not notified.",
      )
    } catch {
      setError("Could not reach the admin service")
    } finally {
      setReplyingId(null)
    }
  }

  return (
    <AdminShell
      active="feedback"
      title="User feedback"
      description="Review submissions, reply by email (as many times as needed), and publish selected quotes to the home ticker."
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

          {items.map((item) => {
            const songNumber = songNumberFromFeedback(item)
            return (
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

              {(item.replies?.length || 0) > 0 ? (
                <div className="mt-4 space-y-2 rounded-xl border border-navy-900/10 bg-ivory-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-stone-500">
                    Replies ({item.replies!.length})
                  </p>
                  {item.replies!.map((reply) => (
                    <div key={reply.reply_id} className="rounded-lg bg-white px-3 py-2 text-sm">
                      <p className="whitespace-pre-wrap text-navy-950">{reply.body}</p>
                      <p className="mt-1 text-[11px] text-stone-500">
                        {reply.author_label}
                        {reply.kind === "system" ? " · system" : ""}
                        {reply.created_at ? ` · ${new Date(reply.created_at).toLocaleString()}` : ""}
                        {reply.email_delivered ? " · emailed" : " · not emailed"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 space-y-2 border-t border-navy-900/10 pt-4">
                <label className="block text-xs font-bold uppercase tracking-[0.12em] text-stone-500">
                  Reply to user
                  <textarea
                    value={replyDrafts[item.feedback_id] || ""}
                    onChange={(e) =>
                      setReplyDrafts((prev) => ({ ...prev, [item.feedback_id]: e.target.value }))
                    }
                    rows={3}
                    placeholder={
                      item.contact
                        ? `Reply will be emailed to ${item.contact}`
                        : "No contact email — reply will be saved only"
                    }
                    className="mt-2 w-full rounded-xl border border-navy-900/10 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-navy-950 outline-none focus:border-gold-500"
                  />
                </label>
                <button
                  type="button"
                  disabled={replyingId === item.feedback_id}
                  onClick={() => void sendReply(item.feedback_id)}
                  className="rounded-full bg-navy-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {replyingId === item.feedback_id ? "Sending…" : "Send reply"}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-navy-900/10 pt-4">
                {item.category === "devanagari" && songNumber ? (
                  <a
                    href={`/admin/devanagari?song=${songNumber}`}
                    className="gold-button px-4 py-2 text-xs"
                  >
                    Review &amp; correct #{songNumber}
                  </a>
                ) : null}
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
            )
          })}
        </div>
    </AdminShell>
  )
}
