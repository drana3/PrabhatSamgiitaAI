"use client"

import { useEffect, useRef, useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import {
  followUpQuestions,
  maximumConversationTurns,
  recentConversation,
  restoreConversation,
} from "@/lib/chat"
import type { ChatMessage } from "@/lib/chat"
import { streamExplanation } from "@/lib/explain"
import { queryGuidanceFor, queryIsUseful } from "@/lib/query-guard"

function greeting(language?: string | null): ChatMessage {
  return {
    role: "assistant",
    text: `Namaskar. I can help you understand this song${language ? ` in ${language}` : ""}, including its imagery, feeling, spiritual context, and related Prabhat Samgiita.`,
    createdAt: Date.now(),
  }
}

export function StreamExplanation({ songNumber, language, prompt }: { songNumber: number; language?: string | null; prompt?: string }) {
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState(prompt ?? "")
  const [inputError, setInputError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([greeting(language)])
  const conversationEnd = useRef<HTMLDivElement | null>(null)
  const storageKey = `prabhat-song-chat-${songNumber}`

  useEffect(() => {
    setHydrated(false)
    let restored: ChatMessage[] = []
    try {
      restored = restoreConversation(window.sessionStorage.getItem(storageKey))
    } catch {
      restored = []
    }
    setMessages([greeting(language), ...restored])
    setHydrated(true)
  }, [language, storageKey])

  useEffect(() => {
    if (!hydrated) return
    try {
      const turns = messages.slice(1).slice(-maximumConversationTurns)
      if (turns.length) window.sessionStorage.setItem(storageKey, JSON.stringify(turns))
      else window.sessionStorage.removeItem(storageKey)
    } catch {
      // The chat remains usable when browser storage is unavailable.
    }
  }, [hydrated, messages, storageKey])

  useEffect(() => {
    conversationEnd.current?.scrollIntoView?.({ block: "nearest" })
  }, [loading, messages])

  async function ask(suggestedPrompt?: string) {
    const typedPrompt = suggestedPrompt ?? query.trim()
    const nextPrompt = (typedPrompt || prompt || "").trim()
    if (!queryIsUseful(nextPrompt, 800)) {
      setInputError(queryGuidanceFor(nextPrompt))
      return
    }

    const now = Date.now()
    const history = recentConversation(messages.slice(1), now)
    setInputError(null)
    setLoading(true)
    setQuery("")
    setMessages((current) => [
      ...current,
      { role: "user", text: nextPrompt, createdAt: now },
      { role: "assistant", text: "", createdAt: now },
    ])
    let streamed = ""
    try {
      await streamExplanation(songNumber, (chunk) => {
        streamed = streamed ? `${streamed}\n${chunk}` : chunk
        setMessages((current) => {
          const next = [...current]
          next[next.length - 1] = { role: "assistant", text: streamed, createdAt: Date.now() }
          return next
        })
      }, nextPrompt, history)
    } catch {
      setMessages((current) => {
        const next = [...current]
        next[next.length - 1] = { role: "assistant", text: "I could not complete that response. Please try again in a moment.", createdAt: Date.now() }
        return next
      })
    } finally {
      setLoading(false)
    }
  }

  const latestUserPrompt = [...messages].reverse().find((message) => message.role === "user")?.text ?? ""
  const nextQuestions = followUpQuestions(latestUserPrompt, language)

  return (
    <section id="ask" className="scroll-mt-28 overflow-hidden rounded-2xl border border-navy-900/10 bg-ivory-50">
      <div className="border-b border-navy-900/10 bg-gold-50/60 p-5">
        <p className="eyebrow">Prabhat Samgiita AI Companion</p>
        <h2 className="mt-2 font-serif text-3xl text-navy-950">Know more about this song</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">Ask about meaning, imagery, spiritual context, pronunciation, or related songs in the language that feels natural to you.</p>
        <p className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Conversation context · 10 minutes</p>
      </div>
      <div aria-live="polite" aria-busy={loading} className="max-h-[32rem] space-y-3 overflow-y-auto p-4 sm:p-5">
        {messages.map((message, index) => {
          const isLatestAnswer = message.role === "assistant" && index === messages.length - 1 && Boolean(message.text) && !loading
          return (
            <div key={`${message.role}-${message.createdAt}-${index}`} className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-7 ${message.role === "user" ? "ml-auto bg-gold-100 text-navy-950" : "border border-navy-900/10 bg-white text-stone-700 shadow-sm"}`}>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700">{message.role === "user" ? "You" : "Prabhat Samgiita AI"}</p>
              {loading && index === messages.length - 1 && !message.text ? <LoadingIndicator label="Reflecting on the sources" /> : <p dir="auto" className="whitespace-pre-wrap">{message.text}</p>}
              {isLatestAnswer ? (
                <div className="mt-4 border-t border-navy-900/10 pt-3">
                  <p className="text-xs font-semibold text-navy-950">Would you like to explore next?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {nextQuestions.map((question) => (
                      <button key={question} type="button" onClick={() => void ask(question)} className="rounded-full border border-gold-500/35 bg-gold-50 px-3 py-1.5 text-left text-xs font-semibold leading-5 text-navy-950 transition hover:border-gold-600 hover:bg-gold-100">
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
        <div ref={conversationEnd} />
      </div>
      <div className="border-t border-navy-900/10 bg-white p-4">
        <label htmlFor={`ask-${songNumber}`} className="sr-only">Ask about this song</label>
        <div className={`flex items-end gap-2 rounded-2xl border bg-ivory-50 p-2 ${inputError ? "border-red-400" : "border-navy-900/10 focus-within:border-gold-500"}`}>
          <textarea
            id={`ask-${songNumber}`}
            value={query}
            onChange={(event) => { setQuery(event.target.value); if (inputError) setInputError(null) }}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (!loading) void ask() } }}
            placeholder="Ask a clear question about this song..."
            rows={2}
            maxLength={800}
            aria-invalid={Boolean(inputError)}
            aria-describedby={inputError ? `ask-${songNumber}-error` : undefined}
            className="min-h-12 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-navy-950 outline-none placeholder:text-stone-400"
          />
          <button type="button" onClick={() => void ask()} disabled={loading} aria-label="Send question" data-feature="ai_companion" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold-600 text-lg text-white transition hover:bg-gold-700 disabled:opacity-50">→</button>
        </div>
        {inputError ? <p id={`ask-${songNumber}-error`} role="alert" className="mt-2 text-sm leading-6 text-red-700">{inputError}</p> : null}
      </div>
    </section>
  )
}
