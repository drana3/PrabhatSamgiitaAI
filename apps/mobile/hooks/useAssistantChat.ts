import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  answerSources,
  classifyAnswer,
  needsNoSourceCaution,
  type AnswerKind,
  type AnswerSource,
} from "@/lib/assistantAnswer"
import { threadsForScope } from "@/lib/assistantHistory"
import { currentQuota } from "@/lib/assistantQuota"
import { serverQuotaLabel, serverQuotaLeft } from "@/lib/assistantServerQuota"
import { runAssistantTurn, buildHistory, type TurnResult } from "@/lib/assistantTurn"
import {
  companionReceivesMemberQuota,
  generalCompanionSuggestions,
  remainingCompanionSuggestions,
  songCompanionSuggestions,
} from "@/lib/chat"
import { api } from "@/lib/client"
import { getCachedMemberEmail, hydrateLocalMemberEmail } from "@/lib/memberEmail"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { songDetailToMockSong } from "@/lib/songMap"
import { useAssistantServerQuotaStore } from "@/stores/assistantServerQuotaStore"
import { useAssistantStore } from "@/stores/assistantStore"
import { useAuthStore } from "@/stores/authStore"
import { useChatStore } from "@/stores/chatStore"
import { usePlayerStore } from "@/stores/playerStore"

export type AssistantMessageView = {
  id: string
  role: "user" | "assistant"
  text: string
  kind: AnswerKind
  sources: AnswerSource[]
  noSourceCaution: boolean
  pending: boolean
}

/**
 * State and actions of the Ask screen. Networking and thread storage are the
 * existing ones (lib/client streamExplanation, stores/chatStore); this hook is
 * the redesign's wiring, so the AI tab keeps working untouched.
 */
export function useAssistantChat(input: { songParam: number | null }) {
  const mode = useAuthStore((s) => s.mode)
  const email = useAuthStore((s) => s.email)
  const memberId = useAuthStore((s) => s.memberId)
  const identityProvider = useAuthStore((s) => s.identityProvider)
  const playerSong = usePlayerStore((s) => s.currentSong)

  const language = useAssistantStore((s) => s.language)
  const setLanguage = useAssistantStore((s) => s.setLanguage)
  const quotaByAccount = useAssistantStore((s) => s.quotaByAccount)
  const noteQuotaReached = useAssistantStore((s) => s.noteQuotaReached)

  const getAccountId = useChatStore((s) => s.getAccountId)
  const byAccount = useChatStore((s) => s.byAccount)
  const beginExchange = useChatStore((s) => s.beginExchange)
  const updateAssistantMessage = useChatStore((s) => s.updateAssistantMessage)
  const hydrateFromServerTurns = useChatStore((s) => s.hydrateFromServerTurns)
  const syncServerHistory = useChatStore((s) => s.syncServerHistory)
  const ensureScopeThread = useChatStore((s) => s.ensureScopeThread)
  const startNewThread = useChatStore((s) => s.startNewThread)
  const setActiveThread = useChatStore((s) => s.setActiveThread)
  const clearAccountMemory = useChatStore((s) => s.clearAccountMemory)

  // The sheet's song: the one it was opened on, else the one playing; the reader can detach it.
  const [detached, setDetached] = useState(false)
  const groundedNumber = detached ? null : (input.songParam ?? playerSong?.number ?? null)
  const [songTitle, setSongTitle] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [syncingHistory, setSyncingHistory] = useState(false)

  const accountId = getAccountId(mode, email, memberId)
  const serverQuota = useAssistantServerQuotaStore((s) => s.byAccount[accountId])
  const reportServerQuota = useAssistantServerQuotaStore((s) => s.report)
  const isMember = companionReceivesMemberQuota({
    signedIn: mode === "signed_in",
    memberAuthReady: memberAuthAvailable(),
    memberId,
    email,
    cachedEmail: getCachedMemberEmail(),
  })

  useEffect(() => {
    if (mode !== "signed_in") return
    void hydrateLocalMemberEmail()
  }, [mode, memberId, identityProvider])

  // Today's allowance from the server, so the counter is there before the first question. A failed read
  // leaves the counter hidden; it never falls back to a guess.
  useEffect(() => {
    const controller = new AbortController()
    void api.fetchDailyQuota(controller.signal).then((report) => {
      if (report && !controller.signal.aborted) reportServerQuota(accountId, report)
    })
    return () => controller.abort()
  }, [accountId, reportServerQuota])

  // Title for the grounding chip.
  useEffect(() => {
    if (!groundedNumber) {
      setSongTitle(null)
      return
    }
    if (playerSong?.number === groundedNumber) {
      setSongTitle(playerSong.title)
      return
    }
    let active = true
    setSongTitle(null)
    void api.fetchSong(groundedNumber).then((detail) => {
      if (active && detail) setSongTitle(songDetailToMockSong(detail).title)
    })
    return () => {
      active = false
    }
  }, [groundedNumber, playerSong?.number, playerSong?.title])

  useEffect(() => {
    ensureScopeThread(accountId, groundedNumber)
  }, [accountId, groundedNumber, ensureScopeThread])

  // Member chat memory on the server, same sync as the AI tab.
  useEffect(() => {
    if (mode !== "signed_in" || !memberAuthAvailable()) return
    let active = true
    setSyncingHistory(true)
    void api
      .fetchMemberChat(groundedNumber ?? undefined)
      .then((memory) => {
        if (!active || !memory.ok) return
        if (!groundedNumber) {
          if (!memory.recent_turns.length && !memory.history_days?.length) return
          syncServerHistory(accountId, memory, null)
          hydrateFromServerTurns(accountId, memory.recent_turns, memory.summary || undefined, null)
          return
        }
        if (!memory.recent_turns.length) return
        hydrateFromServerTurns(accountId, memory.recent_turns, memory.summary || undefined, groundedNumber)
      })
      .finally(() => {
        if (active) setSyncingHistory(false)
      })
    return () => {
      active = false
    }
  }, [mode, accountId, groundedNumber, hydrateFromServerTurns, syncServerHistory])

  const account = byAccount[accountId] ?? { threads: [], activeThreadId: null }
  const activeThread = useMemo(
    () => account.threads.find((thread) => thread.id === account.activeThreadId) ?? null,
    [account],
  )
  const storedMessages = activeThread?.messages
  const messages: AssistantMessageView[] = useMemo(() => {
    const list = storedMessages ?? []
    const lastId = list[list.length - 1]?.id
    return list
      .filter((message) => message.role === "user" || message.text.trim().length > 0 || message.id === lastId)
      .map((message) => {
        if (message.role === "user") {
          return {
            id: message.id,
            role: "user" as const,
            text: message.text,
            kind: "answer" as const,
            sources: [],
            noSourceCaution: false,
            pending: false,
          }
        }
        const pending = sending && message.id === lastId && classifyAnswer(message.text) === "empty"
        const scope = activeThread?.songNumber ?? null
        return {
          id: message.id,
          role: "assistant" as const,
          text: message.text,
          kind: classifyAnswer(message.text),
          sources: answerSources({ text: message.text, groundedNumber: scope }),
          noSourceCaution: needsNoSourceCaution({ text: message.text, groundedNumber: scope }),
          pending,
        }
      })
  }, [storedMessages, sending, activeThread?.songNumber])

  const past = useMemo(
    () => threadsForScope(account.threads, groundedNumber),
    [account.threads, groundedNumber],
  )

  const suggestions = useMemo(() => {
    const starters = groundedNumber
      ? songCompanionSuggestions({ number: groundedNumber, title: songTitle ?? `Prabhat Samgiita ${groundedNumber}` })
      : generalCompanionSuggestions()
    const asked = (storedMessages ?? []).filter((m) => m.role === "user").map((m) => m.text)
    return remainingCompanionSuggestions(starters, asked)
  }, [groundedNumber, songTitle, storedMessages])

  // `left` is the server's own count, or null when it has not reported: then no label is shown. The only thing
  // kept on the phone is "the server said the limit is reached today", which hides the follow-up suggestions.
  const left = serverQuotaLeft(serverQuota, Date.now())
  const reachedToday = currentQuota(quotaByAccount[accountId], new Date()).exhausted
  const quota = {
    left,
    label: serverQuotaLabel(left),
    exhausted: left === null ? reachedToday : left <= 0,
    isMember,
  }

  // leaving the screen cancels the answer in flight: no waiting stream, no quota spent on a reply nobody reads
  const inFlight = useRef<AbortController | null>(null)
  useEffect(() => () => inFlight.current?.abort(), [])

  const send = useCallback(
    async (text: string): Promise<TurnResult> => {
      if (sending) return { status: "ignored" }
      if (mode === "signed_in") await hydrateLocalMemberEmail()
      setSending(true)
      const controller = new AbortController()
      inFlight.current = controller
      try {
        const result = await runAssistantTurn(
          {
            stream: (songNumber, onChunk, prompt, history, onNotice, onQuota) =>
              api.streamExplanation(songNumber, onChunk, prompt, history, controller.signal, onNotice, onQuota),
            beginExchange: (display) => beginExchange(accountId, display),
            updateMessage: (id, value) => updateAssistantMessage(accountId, id, value),
            saveMemory:
              mode === "signed_in" && memberAuthAvailable()
                ? (turns) =>
                    void api.saveMemberChat({ song_number: groundedNumber ?? undefined, turns })
                : undefined,
            onQuota: (report) => reportServerQuota(accountId, report),
          },
          {
            prompt: text,
            history: buildHistory(storedMessages ?? []),
            sheetSong: groundedNumber,
            language,
            isMember,
          },
        )
        if (result.status === "done") {
          if (result.kind === "quota") noteQuotaReached(accountId)
        }
        return result
      } finally {
        if (inFlight.current === controller) inFlight.current = null
        setSending(false)
      }
    },
    [
      sending,
      mode,
      isMember,
      accountId,
      groundedNumber,
      language,
      storedMessages,
      beginExchange,
      updateAssistantMessage,
      noteQuotaReached,
      reportServerQuota,
    ],
  )

  return {
    accountId,
    mode,
    groundedNumber,
    songTitle,
    detachSong: () => setDetached(true),
    attachedFromPlayer: !input.songParam && Boolean(groundedNumber),
    messages,
    suggestions,
    sending,
    syncingHistory,
    quota,
    language,
    setLanguage,
    past,
    activeThreadId: account.activeThreadId,
    send,
    newChat: () => startNewThread(accountId, groundedNumber),
    openThread: (threadId: string) => setActiveThread(accountId, threadId),
    clearHistory: () => clearAccountMemory(accountId),
  }
}
