"use client"

import { useEffect, useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import { useMember } from "@/components/member-provider"
import { submitFeedback } from "@/lib/api"
import { memberFirstName } from "@/lib/member"
import { publishCommunityFeedback } from "@/lib/community-voices"

const categories = [
  ["experience", "Overall experience"],
  ["content", "Lyrics or meaning"],
  ["search", "Search"],
  ["audio_video", "Audio or video"],
  ["ai", "AI response"],
  ["accessibility", "Accessibility"],
] as const

export function FeedbackWidget() {
  const { session } = useMember()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [category, setCategory] = useState("experience")
  const [comment, setComment] = useState("")
  const [sharePublicly, setSharePublicly] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [displayLocation, setDisplayLocation] = useState("")
  const [status, setStatus] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!session.authenticated) return
    setDisplayName((current) => current || memberFirstName(session.display_name))
    setDisplayLocation((current) => current || session.country || "")
  }, [session])

  async function send() {
    if (comment.trim().length < 3) {
      setStatus("Please share at least a few words so we can act on your feedback.")
      return
    }
    setSending(true)
    setStatus("")
    try {
      const message = await submitFeedback({
        category,
        rating,
        comment: comment.trim(),
        page_path: window.location.pathname,
      })
      if (sharePublicly && comment.trim().length >= 12) {
        const name = displayName.trim() || "A fellow seeker"
        publishCommunityFeedback({
          display_name: name,
          display_location: displayLocation.trim() || null,
          quote_text: comment.trim(),
        })
      }
      setStatus(message)
      setComment("")
      setSharePublicly(false)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Feedback could not be sent.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3">
      {open ? (
        <section aria-label="Share feedback" className="w-[22rem] max-w-full rounded-2xl border border-navy-900/10 bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div><p className="eyebrow">Help us improve</p><h2 className="mt-1 font-serif text-2xl text-navy-950">How was your experience?</h2></div>
            <button type="button" aria-label="Close feedback" onClick={() => setOpen(false)} className="rounded-full p-2 text-stone-500 hover:bg-ivory-100">✕</button>
          </div>
          <fieldset className="mt-4"><legend className="text-xs font-bold text-navy-950">Rating</legend><div className="mt-2 flex gap-1">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} star${value === 1 ? "" : "s"}`} aria-pressed={rating === value} className={`text-2xl ${value <= rating ? "text-gold-600" : "text-stone-300"}`}>★</button>)}</div></fieldset>
          <label className="mt-4 block text-xs font-bold text-navy-950" htmlFor="feedback-category">Area</label>
          <select id="feedback-category" value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-xl border border-navy-900/10 bg-ivory-50 px-3 py-2.5 text-sm text-navy-950">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <label className="mt-4 block text-xs font-bold text-navy-950" htmlFor="feedback-comment">Your feedback</label>
          <textarea id="feedback-comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={4} placeholder="Share how Prabhat Samgiita or the AI companion supports your spiritual journey..." className="mt-2 w-full resize-none rounded-xl border border-navy-900/10 bg-ivory-50 px-3 py-2.5 text-sm text-navy-950 outline-none focus:border-gold-500" />
          <label className="mt-4 flex items-start gap-2 text-xs text-navy-950">
            <input
              type="checkbox"
              checked={sharePublicly}
              onChange={(event) => setSharePublicly(event.target.checked)}
              className="mt-0.5"
            />
            <span>Share my words on the community ticker (first name and city only)</span>
          </label>
          {sharePublicly ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-navy-950" htmlFor="feedback-name">
                First name
                <input
                  id="feedback-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={40}
                  placeholder="Ananda"
                  className="mt-1 w-full rounded-xl border border-navy-900/10 bg-ivory-50 px-3 py-2 text-sm text-navy-950 outline-none focus:border-gold-500"
                />
              </label>
              <label className="block text-xs font-bold text-navy-950" htmlFor="feedback-location">
                City or region
                <input
                  id="feedback-location"
                  value={displayLocation}
                  onChange={(event) => setDisplayLocation(event.target.value)}
                  maxLength={80}
                  placeholder="Kolkata, India"
                  className="mt-1 w-full rounded-xl border border-navy-900/10 bg-ivory-50 px-3 py-2 text-sm text-navy-950 outline-none focus:border-gold-500"
                />
              </label>
            </div>
          ) : null}
          {status ? <p role="status" className="mt-3 text-xs leading-5 text-stone-600">{status}</p> : null}
          <button type="button" onClick={() => void send()} disabled={sending} className="mt-4 flex w-full items-center justify-center rounded-xl bg-navy-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{sending ? <LoadingIndicator label="Sending" compact /> : "Send feedback"}</button>
        </section>
      ) : null}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} data-feature="feedback_open" className="rounded-full bg-navy-950 px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-gold-700">Feedback</button>
    </div>
  )
}
