"use client"

import { useState } from "react"

import { streamExplanation } from "@/lib/explain"

export function StreamExplanation({
  songNumber,
  language,
  prompt,
}: {
  songNumber: number
  language?: string | null
  prompt?: string
}) {
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState(prompt ?? "")
  const [messages, setMessages] = useState<Array<{ role: "assistant" | "user"; text: string }>>([
    {
      role: "assistant",
      text: `Ask me anything about this song${language ? ` in ${language}` : ""}. I will answer only from grounded source material.`,
    },
  ])

  return (
    <section className="rounded-[2rem] border border-ink-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ember-700">Grounded AI</p>
          <h2 className="mt-2 font-serif text-3xl text-ink-900">Ask the BOT</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">
            Ask the Prabhat Samgiita AI BOT to explain the song{language ? ` in ${language}` : ""}, compare lines,
            or clarify meaning. It will answer only from verified source material.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4">
        <div className="space-y-3 rounded-[1.5rem] border border-ink-100 bg-gradient-to-br from-ink-50 to-white p-4">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-[92%] rounded-[1.25rem] px-4 py-3 text-sm leading-7 ${
                message.role === "assistant"
                  ? "bg-white text-ink-800 shadow-sm"
                  : "ml-auto bg-ink-950 text-white"
              }`}
            >
              <p className="mb-1 text-[11px] uppercase tracking-[0.25em] opacity-70">
                {message.role === "assistant" ? "Prabhat Samgiita AI BOT" : "You"}
              </p>
              <p className="whitespace-pre-wrap">{message.text}</p>
            </div>
          ))}
        </div>

        <div className="rounded-[1.5rem] border border-ink-100 bg-white p-4 shadow-sm">
          <label className="block text-xs uppercase tracking-[0.3em] text-ink-500">
            Ask a follow-up
          </label>
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Example: Explain the devotional mood of this song."
            className="mt-3 min-h-28 w-full rounded-[1.25rem] border border-ink-200 bg-ink-50 px-4 py-3 text-sm leading-6 text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-ember-300 focus:bg-white"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-full bg-gradient-to-r from-ember-500 to-amber-400 px-5 py-3 text-sm font-semibold text-white transition hover:from-ember-600 hover:to-amber-500 disabled:opacity-60"
              disabled={loading}
              onClick={async () => {
                const nextPrompt = query.trim() || prompt || `Explain song ${songNumber}`
                setLoading(true)
                setText("")
                setMessages((current) => [
                  ...current,
                  { role: "user", text: nextPrompt },
                  { role: "assistant", text: "Thinking..." },
                ])
                let streamed = ""
                await streamExplanation(
                  songNumber,
                  (chunk) => {
                    streamed = streamed ? `${streamed}\n${chunk}` : chunk
                    setText(streamed)
                    setMessages((current) => {
                      const next = [...current]
                      next[next.length - 1] = { role: "assistant", text: streamed }
                      return next
                    })
                  },
                  nextPrompt,
                )
                setLoading(false)
              }}
            >
              {loading ? "Streaming..." : "Ask BOT"}
            </button>
            <span className="text-xs uppercase tracking-[0.25em] text-ink-500">
              Grounded, citation-backed responses
            </span>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-dashed border-ink-200 bg-gradient-to-br from-ink-50 to-white p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-ink-500">
            <span className="h-2 w-2 rounded-full bg-ember-500" />
            Live response
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink-800">
            {text || "The BOT will only use grounded, verified source data."}
          </p>
        </div>
      </div>
    </section>
  )
}
