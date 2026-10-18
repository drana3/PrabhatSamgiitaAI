"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  emptyQuestion,
  qrCodeUrl,
  type QuizEventQuestion,
  type QuizEventSummary,
} from "@/lib/quiz-events"
import { AdminShell } from "@/components/admin-shell"
import { readErrorDetail } from "@/lib/read-error-detail"

type QuizEventDetail = QuizEventSummary & {
  questions?: QuizEventQuestion[]
  submissions?: Array<{
    id: string
    display_name: string
    score: number | null
    status: string
    submitted_at?: string | null
  }>
}

const defaultDeadline = () => {
  const date = new Date()
  date.setHours(date.getHours() + 24)
  return date.toISOString().slice(0, 16)
}

export function AdminQuizPanel() {
  const [events, setEvents] = useState<QuizEventSummary[]>([])
  const [selected, setSelected] = useState<QuizEventDetail | null>(null)
  const [title, setTitle] = useState("Prabhat Samgiita Live Quiz")
  const [description, setDescription] = useState("")
  const [deadline, setDeadline] = useState(defaultDeadline)
  const [tags, setTags] = useState("devotion, community")
  const [questions, setQuestions] = useState<QuizEventQuestion[]>(
    Array.from({ length: 10 }, (_, index) => emptyQuestion(index)),
  )
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/quiz", { cache: "no-store", credentials: "same-origin" })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, `Could not load quiz events (${response.status})`))
        setEvents([])
        return
      }
      setEvents((body as QuizEventSummary[]) ?? [])
    } catch {
      setError("Could not reach the admin service")
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  const updateQuestion = (index: number, patch: Partial<QuizEventQuestion>) => {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      ),
    )
  }

  const updateOption = (questionIndex: number, optionIndex: number, text: string) => {
    setQuestions((current) =>
      current.map((question, index) => {
        if (index !== questionIndex) return question
        const options = question.options.map((option, optIndex) =>
          optIndex === optionIndex ? { ...option, text } : option,
        )
        return { ...question, options }
      }),
    )
  }

  const createEvent = async () => {
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/quiz", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          deadline: new Date(deadline).toISOString(),
          tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          questions,
          publish: true,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, `Could not create quiz event (${response.status})`))
        return
      }
      setSelected(body as QuizEventDetail)
      setNotice("Quiz event published. Share the QR code with participants.")
      await loadEvents()
    } catch {
      setError("Could not reach the admin service")
    } finally {
      setBusy(false)
    }
  }

  const runAction = async (eventId: string, action: "publish" | "verify") => {
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch(`/api/admin/quiz?id=${encodeURIComponent(eventId)}&action=${action}`, {
        method: "PATCH",
        credentials: "same-origin",
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readErrorDetail(body, `Could not update quiz event (${response.status})`))
        return
      }
      setSelected(body as QuizEventDetail)
      setNotice(action === "verify" ? "Results verified. Winners are now visible on home." : "Quiz event published.")
      await loadEvents()
    } catch {
      setError("Could not reach the admin service")
    } finally {
      setBusy(false)
    }
  }

  const selectedQr = useMemo(
    () => (selected?.deep_link ? qrCodeUrl(selected.deep_link) : null),
    [selected?.deep_link],
  )

  return (
    <AdminShell
      active="quiz"
      title="Live quiz events"
      description="Create a 10-question Prabhat Samgiita quiz, publish it instantly, and share the QR code for mobile scanning."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-2xl text-navy-950">Create quiz event</h2>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-navy-900">Title</span>
              <input className="rounded-xl border border-navy-900/15 px-3 py-2" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-navy-900">Description</span>
              <textarea className="min-h-20 rounded-xl border border-navy-900/15 px-3 py-2" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-navy-900">Deadline</span>
                <input type="datetime-local" className="rounded-xl border border-navy-900/15 px-3 py-2" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-navy-900">Tags</span>
                <input className="rounded-xl border border-navy-900/15 px-3 py-2" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="devotion, nature" />
              </label>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {questions.map((question, index) => (
              <div key={index} className="rounded-2xl border border-navy-900/10 bg-ivory-50/70 p-4">
                <p className="text-sm font-semibold text-navy-900">Question {index + 1}</p>
                <textarea
                  className="mt-2 min-h-16 w-full rounded-xl border border-navy-900/15 px-3 py-2 text-sm"
                  value={question.prompt}
                  onChange={(event) => updateQuestion(index, { prompt: event.target.value })}
                  placeholder="Enter the question prompt"
                />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => (
                    <label key={option.id} className="grid gap-1 text-sm">
                      <span className="font-medium text-navy-800">Option {option.id.toUpperCase()}</span>
                      <input
                        className="rounded-xl border border-navy-900/15 px-3 py-2"
                        value={option.text}
                        onChange={(event) => updateOption(index, optionIndex, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <label className="mt-3 grid gap-1 text-sm">
                  <span className="font-medium text-navy-800">Correct answer</span>
                  <select
                    className="rounded-xl border border-navy-900/15 px-3 py-2"
                    value={question.correct_option_id}
                    onChange={(event) => updateQuestion(index, { correct_option_id: event.target.value })}
                  >
                    {question.options.map((option) => (
                      <option key={option.id} value={option.id}>{option.id.toUpperCase()}</option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" className="gold-button" disabled={busy} onClick={() => void createEvent()}>
              {busy ? "Publishing…" : "Publish quiz event"}
            </button>
            {notice ? <p className="text-sm font-medium text-emerald-700">{notice}</p> : null}
            {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm">
            <h2 className="font-serif text-2xl text-navy-950">Share QR code</h2>
            {selected ? (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-stone-600">{selected.title}</p>
                {selectedQr ? (
                  <Image
                    src={selectedQr}
                    alt={`QR code for ${selected.title}`}
                    width={220}
                    height={220}
                    unoptimized
                    className="rounded-2xl border border-navy-900/10"
                  />
                ) : null}
                <p className="break-all rounded-xl bg-ivory-50 px-3 py-2 text-xs text-navy-900">{selected.deep_link}</p>
                <p className="text-xs text-stone-500">Participants scan this in the mobile app before the deadline.</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-stone-600">Publish an event to generate its QR code.</p>
            )}
          </section>

          <section className="rounded-2xl border border-navy-900/10 bg-white p-5 shadow-sm">
            <h2 className="font-serif text-2xl text-navy-950">Recent events</h2>
            {loading ? <p className="mt-3 text-sm text-stone-600">Loading events…</p> : null}
            <div className="mt-4 space-y-3">
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className="w-full rounded-2xl border border-navy-900/10 px-4 py-3 text-left hover:bg-ivory-50"
                  onClick={() => setSelected(event)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-navy-950">{event.title}</p>
                      <p className="text-xs text-stone-500">Deadline {new Date(event.deadline).toLocaleString()}</p>
                    </div>
                    <span className="rounded-full bg-navy-900/5 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-navy-800">
                      {event.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            {selected ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {selected.status === "draft" ? (
                  <button type="button" className="outline-button" disabled={busy} onClick={() => void runAction(selected.id, "publish")}>
                    Publish
                  </button>
                ) : null}
                {selected.status === "closed" || selected.status === "published" ? (
                  <button type="button" className="outline-button" disabled={busy} onClick={() => void runAction(selected.id, "verify")}>
                    Verify results
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </AdminShell>
  )
}
