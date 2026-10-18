import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { ChatMessage } from "@/lib/chat"

export type StoredChatMessage = ChatMessage & {
  id: string
  createdAt: number
}

export type ChatThread = {
  id: string
  title: string
  updatedAt: number
  messages: StoredChatMessage[]
  /** null = global companion (AI tab without a song). */
  songNumber: number | null
}

type AccountChat = {
  threads: ChatThread[]
  activeThreadId: string | null
}

type ChatState = {
  byAccount: Record<string, AccountChat>
  getAccountId: (mode: "guest" | "signed_in", email: string | null) => string
  getAccountChat: (accountId: string) => AccountChat
  getActiveThread: (accountId: string) => ChatThread | null
  ensureActiveThread: (accountId: string) => string
  /** Activate or create the thread for this song scope (null = global companion). */
  ensureScopeThread: (accountId: string, songNumber: number | null) => string
  appendExchange: (accountId: string, userText: string, assistantText: string) => void
  /** Starts a turn with an empty assistant bubble for streaming. Returns assistant message id. */
  beginExchange: (accountId: string, userText: string) => string | null
  updateAssistantMessage: (accountId: string, assistantId: string, text: string) => void
  /** Seeds a thread from server chat-memory turns when the local thread is empty. */
  hydrateFromServerTurns: (
    accountId: string,
    turns: Array<{ role: "user" | "assistant"; content: string }>,
    title?: string,
    songNumber?: number | null,
  ) => void
  /** Syncs server history on sign-in; replaces local thread when server has more context. */
  syncServerHistory: (
    accountId: string,
    memory: {
      recent_turns: Array<{ role: "user" | "assistant"; content: string }>
      history_days?: Array<{
        date: string
        turns: Array<{ role: "user" | "assistant"; content: string }>
      }>
      summary?: string
      archived_summary?: string
    },
    songNumber?: number | null,
  ) => void
  startNewThread: (accountId: string, songNumber?: number | null) => string
  setActiveThread: (accountId: string, threadId: string) => void
  clearAccountMemory: (accountId: string) => void
}

const emptyAccount = (): AccountChat => ({ threads: [], activeThreadId: null })

function titleFromPrompt(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ")
  if (cleaned.length <= 42) return cleaned
  return `${cleaned.slice(0, 42)}…`
}

function threadSongNumber(thread: ChatThread): number | null {
  return typeof thread.songNumber === "number" ? thread.songNumber : null
}

function flattenServerTurns(
  memory: {
    recent_turns: Array<{ role: "user" | "assistant"; content: string }>
    history_days?: Array<{
      date: string
      turns: Array<{ role: "user" | "assistant"; content: string }>
    }>
  },
): Array<{ role: "user" | "assistant"; content: string }> {
  if (memory.history_days?.length) {
    return memory.history_days
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .flatMap((day) => day.turns)
  }
  return memory.recent_turns
}

function applyServerThread(
  accountId: string,
  turns: Array<{ role: "user" | "assistant"; content: string }>,
  title: string | undefined,
  songNumber: number | null,
) {
  const cleaned = turns
    .map((turn) => ({ role: turn.role, content: turn.content.trim() }))
    .filter((turn) => turn.content.length > 0)
  if (!cleaned.length) return

  const now = Date.now()
  const messages: StoredChatMessage[] = cleaned.map((turn, index) => ({
    id: `server-${now}-${index}`,
    role: turn.role,
    text: turn.content,
    createdAt: now + index,
  }))
  const thread: ChatThread = {
    id: `thread-server-${now}`,
    title: title || titleFromPrompt(cleaned[0]?.content || "Synced conversation"),
    updatedAt: now,
    messages,
    songNumber,
  }
  useChatStore.setState((state) => {
    const current = state.byAccount[accountId] ?? emptyAccount()
    const withoutScope = current.threads.filter(
      (item) => threadSongNumber(item) !== thread.songNumber,
    )
    return {
      byAccount: {
        ...state.byAccount,
        [accountId]: {
          activeThreadId: thread.id,
          threads: [thread, ...withoutScope],
        },
      },
    }
  })
}

function createThread(firstPrompt?: string, songNumber: number | null = null): ChatThread {
  const now = Date.now()
  return {
    id: `thread-${now}-${Math.random().toString(36).slice(2, 9)}`,
    title: firstPrompt
      ? titleFromPrompt(firstPrompt)
      : songNumber
        ? `Song ${songNumber}`
        : "New conversation",
    updatedAt: now,
    messages: [],
    songNumber,
  }
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      byAccount: {},

      getAccountId: (mode, email) => {
        if (mode === "signed_in" && email) return `member:${email.toLowerCase()}`
        return "guest"
      },

      getAccountChat: (accountId) => get().byAccount[accountId] ?? emptyAccount(),

      getActiveThread: (accountId) => {
        const account = get().getAccountChat(accountId)
        if (!account.activeThreadId) return null
        return account.threads.find((t) => t.id === account.activeThreadId) ?? null
      },

      ensureActiveThread: (accountId) => {
        const account = get().getAccountChat(accountId)
        if (account.activeThreadId && account.threads.some((t) => t.id === account.activeThreadId)) {
          return account.activeThreadId
        }
        return get().ensureScopeThread(accountId, null)
      },

      ensureScopeThread: (accountId, songNumber) => {
        const account = get().getAccountChat(accountId)
        const active = account.threads.find((thread) => thread.id === account.activeThreadId)
        // Keep the current thread when it already matches this song scope (supports
        // multiple threads per song via "New chat").
        if (active && threadSongNumber(active) === songNumber) {
          return active.id
        }
        const existing = [...account.threads]
          .filter((thread) => threadSongNumber(thread) === songNumber)
          .sort((a, b) => b.updatedAt - a.updatedAt)[0]
        if (existing) {
          set((state) => ({
            byAccount: {
              ...state.byAccount,
              [accountId]: { ...account, activeThreadId: existing.id },
            },
          }))
          return existing.id
        }
        const thread = createThread(undefined, songNumber)
        set((state) => {
          const current = state.byAccount[accountId] ?? emptyAccount()
          return {
            byAccount: {
              ...state.byAccount,
              [accountId]: {
                threads: [thread, ...current.threads],
                activeThreadId: thread.id,
              },
            },
          }
        })
        return thread.id
      },

      appendExchange: (accountId, userText, assistantText) => {
        const trimmed = userText.trim()
        if (!trimmed) return
        const now = Date.now()
        const userMsg: StoredChatMessage = {
          id: `u-${now}`,
          role: "user",
          text: trimmed,
          createdAt: now,
        }
        const assistantMsg: StoredChatMessage = {
          id: `a-${now + 1}`,
          role: "assistant",
          text: assistantText,
          createdAt: now + 1,
        }

        set((state) => {
          const account = state.byAccount[accountId] ?? emptyAccount()
          let threads = [...account.threads]
          let activeId = account.activeThreadId
          let thread = threads.find((t) => t.id === activeId)

          if (!thread) {
            thread = createThread(trimmed, null)
            activeId = thread.id
            threads = [thread, ...threads]
          }

          const updated: ChatThread = {
            ...thread,
            songNumber: threadSongNumber(thread),
            title: thread.messages.length === 0 ? titleFromPrompt(trimmed) : thread.title,
            updatedAt: now,
            messages: [...thread.messages, userMsg, assistantMsg],
          }

          return {
            byAccount: {
              ...state.byAccount,
              [accountId]: {
                activeThreadId: activeId,
                threads: threads.map((t) => (t.id === updated.id ? updated : t)),
              },
            },
          }
        })
      },

      beginExchange: (accountId, userText) => {
        const trimmed = userText.trim()
        if (!trimmed) return null
        const now = Date.now()
        const userMsg: StoredChatMessage = {
          id: `u-${now}`,
          role: "user",
          text: trimmed,
          createdAt: now,
        }
        const assistantMsg: StoredChatMessage = {
          id: `a-${now + 1}`,
          role: "assistant",
          text: "",
          createdAt: now + 1,
        }

        set((state) => {
          const account = state.byAccount[accountId] ?? emptyAccount()
          let threads = [...account.threads]
          let activeId = account.activeThreadId
          let thread = threads.find((t) => t.id === activeId)

          if (!thread) {
            thread = createThread(trimmed, null)
            activeId = thread.id
            threads = [thread, ...threads]
          }

          const updated: ChatThread = {
            ...thread,
            songNumber: threadSongNumber(thread),
            title: thread.messages.length === 0 ? titleFromPrompt(trimmed) : thread.title,
            updatedAt: now,
            messages: [...thread.messages, userMsg, assistantMsg],
          }

          return {
            byAccount: {
              ...state.byAccount,
              [accountId]: {
                activeThreadId: activeId,
                threads: threads.map((t) => (t.id === updated.id ? updated : t)),
              },
            },
          }
        })
        return assistantMsg.id
      },

      updateAssistantMessage: (accountId, assistantId, text) => {
        set((state) => {
          const account = state.byAccount[accountId] ?? emptyAccount()
          const activeId = account.activeThreadId
          if (!activeId) return state
          return {
            byAccount: {
              ...state.byAccount,
              [accountId]: {
                ...account,
                threads: account.threads.map((thread) => {
                  if (thread.id !== activeId) return thread
                  return {
                    ...thread,
                    updatedAt: Date.now(),
                    messages: thread.messages.map((message) =>
                      message.id === assistantId ? { ...message, text } : message,
                    ),
                  }
                }),
              },
            },
          }
        })
      },

      hydrateFromServerTurns: (accountId, turns, title, songNumber = null) => {
        const cleaned = turns
          .map((turn) => ({ role: turn.role, content: turn.content.trim() }))
          .filter((turn) => turn.content.length > 0)
        if (!cleaned.length) return

        get().ensureScopeThread(accountId, songNumber ?? null)
        const account = get().getAccountChat(accountId)
        const active = account.threads.find((thread) => thread.id === account.activeThreadId)
        if (active && active.messages.length > 0) return

        applyServerThread(accountId, cleaned, title, songNumber ?? null)
      },

      syncServerHistory: (accountId, memory, songNumber = null) => {
        const scope = songNumber ?? null
        const turns = flattenServerTurns(memory)
        if (!turns.length) return

        const account = get().getAccountChat(accountId)
        const scoped = account.threads.filter((thread) => threadSongNumber(thread) === scope)
        const bestLocal = [...scoped].sort((a, b) => b.updatedAt - a.updatedAt)[0]
        if (bestLocal && bestLocal.messages.length >= turns.length) return

        applyServerThread(
          accountId,
          turns,
          memory.summary || memory.archived_summary || undefined,
          scope,
        )
      },

      startNewThread: (accountId, songNumber = null) => {
        const thread = createThread(undefined, songNumber ?? null)
        set((state) => {
          const account = state.byAccount[accountId] ?? emptyAccount()
          return {
            byAccount: {
              ...state.byAccount,
              [accountId]: {
                threads: [thread, ...account.threads],
                activeThreadId: thread.id,
              },
            },
          }
        })
        return thread.id
      },

      setActiveThread: (accountId, threadId) => {
        set((state) => {
          const account = state.byAccount[accountId] ?? emptyAccount()
          if (!account.threads.some((t) => t.id === threadId)) return state
          return {
            byAccount: {
              ...state.byAccount,
              [accountId]: { ...account, activeThreadId: threadId },
            },
          }
        })
      },

      clearAccountMemory: (accountId) => {
        set((state) => ({
          byAccount: {
            ...state.byAccount,
            [accountId]: emptyAccount(),
          },
        }))
      },
    }),
    {
      name: "prabhat-chat-memory",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ byAccount: state.byAccount }),
    },
  ),
)
