import { create } from "zustand"

import { serverQuotaFrom, type QuotaReport, type ServerQuota } from "@/lib/assistantServerQuota"

/**
 * The last allowance the server reported, per account. Memory only: a number kept across launches could be
 * from another day, and the screen asks the server again when it opens.
 */
type State = {
  byAccount: Record<string, ServerQuota>
  report: (accountId: string, report: QuotaReport, now?: number) => void
  clear: () => void
}

export const useAssistantServerQuotaStore = create<State>()((set) => ({
  byAccount: {},
  report: (accountId, report, now = Date.now()) =>
    set((state) => ({ byAccount: { ...state.byAccount, [accountId]: serverQuotaFrom(report, now) } })),
  clear: () => set({ byAccount: {} }),
}))
