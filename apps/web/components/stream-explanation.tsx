"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import { VoiceQuestionButton } from "@/components/voice-question-button"
import {
  chatMemoryTurnsForSave,
  clearGuestChatStorage,
  followUpsFromMessages,
  formatAssistantMessage,
  hasUserMessages,
  legacySongChatStorageKey,
  maximumConversationTurns,
  recentConversation,
  restoreConversation,
  songChatStorageKey,
  starterPrompts,
  storedMemberConversationMs,
} from "@/lib/chat"
import type { ChatMessage } from "@/lib/chat"
import { conversationLanguage } from "@/lib/chat-language"
import { streamExplanation } from "@/lib/explain"
import { queryGuidanceFor, queryIsUseful } from "@/lib/query-guard"
import { useMember } from "@/components/member-provider"
import { fetchMemberChat, saveMemberChat } from "@/lib/member"

function greeting(): ChatMessage {
  return {
    role: "assistant",
    text: "Namaskar. I can help you understand this song — its meaning, imagery, spiritual context, pronunciation, and related Prabhat Samgiita. Ask in English, or in the language that feels natural to you.",
    createdAt: Date.now(),
  }
}

export function StreamExplanation({ songNumber, prompt }: { songNumber: number; language?: string | null; prompt?: string }) {
  const { loading: memberLoading, session } = useMember()
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState(prompt ?? "")
  const [inputError, setInputError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [syncingHistory, setSyncingHistory] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([greeting()])
  const [profileSummary, setProfileSummary] = useState("")
  const conversationEnd = useRef<HTMLDivElement | null>(null)
  const previousAuth = useRef(session.authenticated)
  const memberId = session.authenticated ? session.id : null
  const storageKey = songChatStorageKey(songNumber, session.authenticated, memberId)

  function resetConversation() {
    try {
      window.sessionStorage.removeItem(storageKey)
    } catch {
      // Storage may be unavailable in private browsing modes.
    }
    setMessages([greeting()])
    setQuery(prompt ?? "")
    setInputError(null)
  }

  useEffect(() => {
    if (memberLoading) {
      setSyncingHistory(Boolean(session.authenticated))
      return
    }

    const signedOut = previousAuth.current && !session.authenticated
    previousAuth.current = session.authenticated

    if (signedOut) {
      clearGuestChatStorage()
      setMessages([greeting()])
      setProfileSummary("")
      setSyncingHistory(false)
      setHydrated(true)
      return
    }

    setHydrated(false)
    let restored: ChatMessage[] = []
    try {
      window.sessionStorage.removeItem(legacySongChatStorageKey(songNumber))
      // Keep member-scoped cache across guest hydration so sign-out → sign-in
      // can restore from sessionStorage while server memory loads.
      restored = restoreConversation(
        window.sessionStorage.getItem(storageKey),
        Date.now(),
        session.authenticated ? storedMemberConversationMs : undefined,
      )
    } catch {
      restored = []
    }
    if (!session.authenticated) {
      setMessages(restored.length ? [greeting(), ...restored] : [greeting()])
      setProfileSummary("")
      setSyncingHistory(false)
      setHydrated(true)
      return
    }

    setMessages(restored.length ? [greeting(), ...restored] : [greeting()])
    setSyncingHistory(true)
    let active = true
    async function loadMemberConversation() {
      let memory = await fetchMemberChat(songNumber)
      if (!active) return
      // OAuth return can briefly 401 before the proxy is ready; retry once.
      if (!memory.ok) {
        await new Promise((resolve) => window.setTimeout(resolve, 400))
        if (!active) return
        memory = await fetchMemberChat(songNumber)
      }
      if (!active) return
      setProfileSummary(memory.summary)
      const remote = memory.recent_turns.map((turn, index) => ({
        role: turn.role,
        text: turn.role === "assistant" ? formatAssistantMessage(turn.content) : turn.content,
        createdAt: Date.now() - ((memory.recent_turns.length - index) * 1000),
      } satisfies ChatMessage))
      const seen = new Set<string>()
      const merged = [...remote, ...restored].filter((turn) => {
        const key = `${turn.role}:${turn.text}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }).slice(-maximumConversationTurns)
      setMessages([greeting(), ...merged])
      setSyncingHistory(false)
      setHydrated(true)
    }
    void loadMemberConversation()
    return () => { active = false }
  }, [memberLoading, memberId, session.authenticated, songNumber, storageKey])

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
      }, nextPrompt, history, profileSummary)
      if (streamed && session.authenticated) {
        const turns = chatMemoryTurnsForSave(nextPrompt, streamed)
        if (turns.length) {
          let saved = await saveMemberChat({ song_number: songNumber, turns })
          if (!saved) {
            await new Promise((resolve) => window.setTimeout(resolve, 350))
            saved = await saveMemberChat({ song_number: songNumber, turns })
          }
        }
      }
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

  const nextQuestions = followUpsFromMessages(messages)
  const userTurns = hasUserMessages(messages)
  const suggestedPrompts = starterPrompts(conversationLanguage(
    messages.filter((message) => message.role === "user").map((message) => message.text),
  ))
  const companionStatus = syncingHistory
    ? { label: "Syncing chat history", ready: false }
    : { label: "Ready to help", ready: true }

  return (
    <section id="ask" className="scroll-mt-28 overflow-hidden rounded-2xl border border-navy-900/10 bg-ivory-50 shadow-[0_18px_50px_rgba(34,28,18,0.08)]">
      <div className="relative overflow-hidden border-b border-navy-900/10 bg-[radial-gradient(circle_at_top_right,rgba(244,202,112,0.35),transparent_42%),linear-gradient(135deg,#fffaf0,#fffdf8)] p-5 sm:p-6">
        <div aria-hidden="true" className="absolute -right-10 -top-12 h-36 w-36 rounded-full border border-gold-500/15" />
        <div className="relative flex items-start gap-4">
          <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-gold-500/25 bg-white shadow-sm">
            <Image src="/brand/prabhat-samgiita-emblem.png" alt="" width={42} height={42} className="h-10 w-10 object-contain" />
            <span aria-hidden="true" className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-[3px] border-white ${companionStatus.ready ? "bg-emerald-500" : "bg-gold-500"}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="eyebrow">Prabhat Samgiita AI Companion</p>
              <p
                role="status"
                aria-label={companionStatus.ready ? "AI companion ready to help" : "Syncing your chat history"}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                  companionStatus.ready
                    ? "border-emerald-700/15 bg-emerald-50 text-emerald-700"
                    : "border-gold-700/20 bg-gold-50 text-gold-800"
                }`}
              >
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${companionStatus.ready ? "bg-emerald-500" : "animate-pulse bg-gold-600"}`} />
                {companionStatus.label}
              </p>
            </div>
            <h2 className="mt-2 font-serif text-3xl leading-tight text-navy-950 sm:text-[2rem]">Know more about this song</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">Ask about meaning, imagery, spiritual context, pronunciation, or related songs in the language that feels natural to you.</p>
            <p className="mt-3 inline-flex rounded-full border border-navy-900/5 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">{session.authenticated ? "Signed in · grounded answers first · 50 deeper AI requests/day" : "Guest · grounded answers first · 15 deeper AI questions/day"}</p>
            {hasUserMessages(messages) && !syncingHistory ? (
              <button
                type="button"
                onClick={resetConversation}
                className="mt-3 rounded-full border border-navy-900/10 bg-white px-3 py-1.5 text-[11px] font-semibold text-navy-950 transition hover:border-gold-500/40"
              >
                Start fresh
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <div aria-live="polite" aria-busy={loading || syncingHistory} className="max-h-[32rem] space-y-4 overflow-y-auto bg-[linear-gradient(rgba(9,45,86,0.025)_1px,transparent_1px)] bg-[length:100%_3rem] p-4 sm:p-5">
        {syncingHistory ? (
          <div className="rounded-2xl border border-gold-500/25 bg-white px-4 py-3 shadow-sm">
            <LoadingIndicator label="Syncing your chat history" />
            <p className="mt-2 text-xs leading-5 text-stone-600">
              Loading earlier questions for this song so they appear in order.
            </p>
          </div>
        ) : null}
        {messages.map((message, index) => {
          const isGreeting = index === 0 && message.role === "assistant"
          const isLatestAnswer = message.role === "assistant" && index === messages.length - 1 && Boolean(message.text) && !loading
          const displayText = message.role === "assistant" ? formatAssistantMessage(message.text) : message.text
          return (
            <div key={`${message.role}-${message.createdAt}-${index}`} className={`flex items-end gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" ? (
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gold-500/25 bg-white shadow-sm">
                  <Image src="/brand/prabhat-samgiita-emblem.png" alt="Prabhat Samgiita AI" width={23} height={23} className="h-5 w-5 object-contain" />
                </div>
              ) : null}
              <div className={`max-w-[88%] px-4 py-3 text-sm leading-7 sm:max-w-[82%] ${message.role === "user" ? "rounded-2xl rounded-br-md bg-navy-950 text-white shadow-sm" : "rounded-2xl rounded-bl-md border border-navy-900/10 bg-white text-stone-700 shadow-sm"}`}>
                <p className={`mb-1 text-[10px] font-bold uppercase tracking-[0.16em] ${message.role === "user" ? "text-gold-200" : "text-gold-700"}`}>{message.role === "user" ? "You" : "Prabhat Samgiita AI"}</p>
                {loading && index === messages.length - 1 && !message.text ? <LoadingIndicator label="Reading the song and preparing your answer" /> : <p dir="auto" className="whitespace-pre-wrap">{displayText}</p>}
                {isGreeting && !userTurns && !loading && !syncingHistory ? (
                  <div className="mt-4 border-t border-navy-900/10 pt-3">
                    <p className="text-xs font-semibold text-navy-950">Try asking</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {suggestedPrompts.map((question) => (
                        <button key={question} type="button" onClick={() => void ask(question)} className="rounded-full border border-gold-500/35 bg-gold-50 px-3 py-1.5 text-left text-xs font-semibold leading-5 text-navy-950 transition hover:border-gold-600 hover:bg-gold-100">
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {isLatestAnswer && userTurns && nextQuestions.length ? (
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
            </div>
          )
        })}
        <div ref={conversationEnd} />
      </div>
      <div className="border-t border-navy-900/10 bg-white p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <p className="text-xs font-semibold text-navy-950">Your question</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">Enter to send · Shift + Enter for a new line</p>
        </div>
        <label htmlFor={`ask-${songNumber}`} className="sr-only">Ask about this song</label>
        <div className={`flex items-end gap-2 rounded-2xl border-2 bg-ivory-50 p-2 shadow-inner transition ${inputError ? "border-red-400" : "border-navy-900/10 focus-within:border-gold-500 focus-within:bg-white"}`}>
          <textarea
            id={`ask-${songNumber}`}
            value={query}
            onChange={(event) => { setQuery(event.target.value); if (inputError) setInputError(null) }}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (!loading && !syncingHistory) void ask() } }}
            placeholder="Ask Prabhat Samgiita AI about this song..."
            rows={2}
            maxLength={800}
            disabled={syncingHistory}
            aria-invalid={Boolean(inputError)}
            aria-describedby={inputError ? `ask-${songNumber}-error` : undefined}
            className="min-h-12 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-navy-950 outline-none placeholder:text-stone-400 disabled:opacity-60"
          />
          <VoiceQuestionButton
            disabled={loading || syncingHistory}
            onTranscript={(transcript) => {
              setQuery(transcript)
              setInputError(null)
            }}
            onError={setInputError}
          />
          <button type="button" onClick={() => void ask()} disabled={loading || syncingHistory} aria-label="Send question" data-feature="ai_companion" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold-600 text-lg text-white shadow-sm transition hover:bg-gold-700 disabled:opacity-50">→</button>
        </div>
        {inputError ? <p id={`ask-${songNumber}-error`} role="alert" className="mt-2 text-sm leading-6 text-red-700">{inputError}</p> : null}
      </div>
    </section>
  )
}
