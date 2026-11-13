import { beforeEach, describe, expect, it, vi } from "vitest"

import { runAssistantTurn, type TurnDeps } from "@/lib/assistantTurn"
import { serverQuotaFrom, serverQuotaLabel, serverQuotaLeft } from "@/lib/assistantServerQuota"
import { useAssistantServerQuotaStore } from "@/stores/assistantServerQuotaStore"

const noon = Date.UTC(2026, 10, 6, 12, 0, 0)

describe("the counter comes from the server's report", () => {
  it("turns a report into a deadline and a number", () => {
    const quota = serverQuotaFrom({ limit: 15, remaining: 11, resetSeconds: 3600 }, noon)
    expect(quota).toEqual({ limit: 15, remaining: 11, resetsAt: noon + 3_600_000 })
    expect(serverQuotaLeft(quota, noon + 10_000)).toBe(11)
  })

  it("says nothing until the server has reported", () => {
    expect(serverQuotaLeft(undefined, noon)).toBeNull()
    expect(serverQuotaLabel(null)).toBeNull()
  })

  it("says nothing once the server's day has ended", () => {
    const quota = serverQuotaFrom({ limit: 15, remaining: 0, resetSeconds: 60 }, noon)
    expect(serverQuotaLeft(quota, noon + 59_999)).toBe(0)
    expect(serverQuotaLeft(quota, noon + 60_000)).toBeNull()
    expect(serverQuotaLeft(quota, noon + 90_000)).toBeNull()
  })

  it("words the number in the app language (English here)", () => {
    expect(serverQuotaLabel(13)).toBe("13 questions left today")
    expect(serverQuotaLabel(1)).toBe("1 question left today")
    expect(serverQuotaLabel(0)).toBe("No questions left today")
  })
})

describe("the store of reports", () => {
  beforeEach(() => useAssistantServerQuotaStore.getState().clear())

  it("keeps one report per account and the newest wins", () => {
    const { report } = useAssistantServerQuotaStore.getState()
    report("guest", { limit: 15, remaining: 14, resetSeconds: 100 }, noon)
    report("member:a", { limit: 50, remaining: 49, resetSeconds: 100 }, noon)
    report("guest", { limit: 15, remaining: 13, resetSeconds: 90 }, noon + 10_000)
    const { byAccount } = useAssistantServerQuotaStore.getState()
    expect(byAccount["guest"]?.remaining).toBe(13)
    expect(byAccount["member:a"]?.limit).toBe(50)
  })
})

describe("runAssistantTurn and the report", () => {
  function deps(extra: Partial<TurnDeps> & { report?: { limit: number; remaining: number; resetSeconds: number } }) {
    const { report, ...rest } = extra
    const stream = vi.fn(
      async (
        _song: number,
        onChunk: (c: string) => void,
        _prompt: string,
        _history: unknown[],
        _onNotice?: (code: string) => void,
        onQuota?: (q: { limit: number; remaining: number; resetSeconds: number }) => void,
      ) => {
        if (report) onQuota?.(report)
        onChunk("PS 12 is about longing.")
      },
    )
    const value: TurnDeps = {
      stream,
      beginExchange: () => "a-1",
      updateMessage: () => undefined,
      ...rest,
    }
    return { value, stream }
  }
  const input = { prompt: "What is this song about?", history: [], sheetSong: 12, language: "auto" as const }

  it("hands the server's allowance to the caller", async () => {
    const onQuota = vi.fn()
    const { value } = deps({ report: { limit: 15, remaining: 9, resetSeconds: 500 }, onQuota })
    await runAssistantTurn(value, input)
    expect(onQuota).toHaveBeenCalledWith({ limit: 15, remaining: 9, resetSeconds: 500 })
  })

  it("does not invent a report when the server sent none", async () => {
    const onQuota = vi.fn()
    const { value } = deps({ onQuota })
    await runAssistantTurn(value, input)
    expect(onQuota).not.toHaveBeenCalled()
  })

  it("works for a caller that does not listen", async () => {
    const { value } = deps({ report: { limit: 15, remaining: 9, resetSeconds: 500 } })
    const result = await runAssistantTurn(value, input)
    expect(result.status).toBe("done")
  })
})
