"use client"

import { useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import { streamExplanation } from "@/lib/explain"

type ChatMessage = {
  role: "assistant" | "user"
  text: string
  createdAt: number
}

const contextWindowMs = 10 * 60 * 1000

export function StreamExplanation({ songNumber, language, prompt }: { songNumber: number; language?: string | null; prompt?: string }) {
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState(prompt ?? "")
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: `Namaskar. I can help you understand this song${language ? ` in ${language}` : ""}, including its imagery, feeling, spiritual context, and related Prabhat Samgiita.`, createdAt: Date.now() },
  ])

  async function ask() {
    const nextPrompt = query.trim() || prompt || `Explain song ${songNumber}`
    const now = Date.now()
    const history = messages
      .slice(1)
      .filter((message) => message.text.trim() && now - message.createdAt <= contextWindowMs)
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.text.slice(0, 2000) }))
    setLoading(true)
    setQuery("")
    setMessages((current) => [...current, { role: "user", text: nextPrompt, createdAt: now }, { role: "assistant", text: "", createdAt: now }])
    let streamed = ""
    try {
      await streamExplanation(songNumber, (chunk) => {
        streamed = streamed ? `${streamed}\n${chunk}` : chunk
        setMessages((current) => {
          const next = [...current]
          next[next.length - 1] = { role: "assistant", text: streamed, createdAt: now }
          return next
        })
      }, nextPrompt, history)
    } catch {
      setMessages((current) => {
        const next = [...current]
        next[next.length - 1] = { role: "assistant", text: "I could not complete that response. Please try again in a moment.", createdAt: now }
        return next
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="ask" className="scroll-mt-28 overflow-hidden rounded-2xl border border-navy-900/10 bg-ivory-50">
      <div className="border-b border-navy-900/10 bg-gold-50/60 p-5">
        <p className="eyebrow">Prabhat Samgiita AI Companion</p>
        <h2 className="mt-2 font-serif text-3xl text-navy-950">Know more about this song</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">Ask about meaning, imagery, spiritual context, pronunciation, or related songs in the language that feels natural to you.</p>
        <p className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Conversation context · 10 minutes</p>
      </div>
      <div aria-live="polite" aria-busy={loading} className="max-h-[32rem] space-y-3 overflow-y-auto p-4 sm:p-5">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-7 ${message.role === "user" ? "ml-auto bg-gold-100 text-navy-950" : "border border-navy-900/10 bg-white text-stone-700 shadow-sm"}`}>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700">{message.role === "user" ? "You" : "Prabhat Samgiita AI"}</p>
            {loading && index === messages.length - 1 && !message.text ? <LoadingIndicator label="Reflecting on the sources" /> : <p dir="auto" className="whitespace-pre-wrap">{message.text}</p>}
          </div>
        ))}
      </div>
      <div className="border-t border-navy-900/10 bg-white p-4">
        <label htmlFor={`ask-${songNumber}`} className="sr-only">Ask about this song</label>
        <div className="flex items-end gap-2 rounded-2xl border border-navy-900/10 bg-ivory-50 p-2 focus-within:border-gold-500">
          <textarea id={`ask-${songNumber}`} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (!loading) void ask() } }} placeholder="Ask anything about this song..." rows={2} className="min-h-12 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-navy-950 outline-none placeholder:text-stone-400" />
          <button type="button" onClick={() => void ask()} disabled={loading} aria-label="Send question" data-feature="ai_companion" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold-600 text-lg text-white transition hover:bg-gold-700 disabled:opacity-50">→</button>
        </div>
      </div>
    </section>
  )
}
