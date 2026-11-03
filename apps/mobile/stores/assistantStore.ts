import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { isAssistantLanguage, type AssistantLanguage } from "@/lib/assistantLanguage"
import {
  markQuotaExhausted,
  recordQuestion,
  type QuotaState,
} from "@/lib/assistantQuota"

/**
 * Settings and the daily tally of the Ask assistant (redesign). Chat threads
 * stay in chatStore, shared with the existing AI tab.
 */
type AssistantState = {
  language: AssistantLanguage
  quotaByAccount: Record<string, QuotaState>
  setLanguage: (language: AssistantLanguage) => void
  noteQuestion: (accountId: string, now?: Date) => void
  noteQuotaReached: (accountId: string, now?: Date) => void
}

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set) => ({
      language: "auto",
      quotaByAccount: {},
      setLanguage: (language) => set({ language: isAssistantLanguage(language) ? language : "auto" }),
      noteQuestion: (accountId, now = new Date()) =>
        set((state) => ({
          quotaByAccount: {
            ...state.quotaByAccount,
            [accountId]: recordQuestion(state.quotaByAccount[accountId], now),
          },
        })),
      noteQuotaReached: (accountId, now = new Date()) =>
        set((state) => ({
          quotaByAccount: {
            ...state.quotaByAccount,
            [accountId]: markQuotaExhausted(state.quotaByAccount[accountId], now),
          },
        })),
    }),
    {
      name: "prabhat-assistant-v2",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ language: state.language, quotaByAccount: state.quotaByAccount }),
    },
  ),
)
