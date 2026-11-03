import { describe, expect, it, vi } from "vitest"

import { buildHistory, friendlyError, runAssistantTurn, type TurnDeps } from "@/lib/assistantTurn"
import { groupThreadsByDay, questionCountLabel, threadsForScope } from "@/lib/assistantHistory"
import type { ChatThread } from "@/stores/chatStore"

function makeDeps(chunks: string[], opts: { throws?: Error } = {}) {
  const updates: string[] = []
  const stream = vi.fn(async (_song: number, onChunk: (c: string) => void) => {
    if (opts.throws) throw opts.throws
    for (const chunk of chunks) onChunk(chunk)
  })
  const saveMemory = vi.fn()
  const deps: TurnDeps = {
    stream,
    beginExchange: () => "a-1",
    updateMessage: (_id, text) => updates.push(text),
    saveMemory,
  }
  return { deps, updates, stream, saveMemory }
}

describe("runAssistantTurn", () => {
  it("blocks unusable questions before any request", async () => {
    const { deps, stream } = makeDeps([])
    const result = await runAssistantTurn(deps, {
      prompt: "djcvjcvhjcvhjc",
      history: [],
      sheetSong: 12,
      language: "auto",
    })
    expect(result.status).toBe("blocked")
    expect(stream).not.toHaveBeenCalled()
  })

  it("streams an answer grounded on the sheet song and saves it", async () => {
    const { deps, updates, stream, saveMemory } = makeDeps(["PS 12 is about longing.", " It ends in trust."])
    const result = await runAssistantTurn(deps, {
      prompt: "What is this song about?",
      history: [],
      sheetSong: 12,
      language: "auto",
    })
    expect(stream.mock.calls[0][0]).toBe(12)
    expect(updates.length).toBeGreaterThanOrEqual(3)
    expect(result).toMatchObject({
      status: "done",
      kind: "answer",
      songNumber: 12,
      grounding: { kind: "song", number: 12 },
    })
    expect(saveMemory).toHaveBeenCalledTimes(1)
  })

  it("a PS number in the question wins over the sheet song", async () => {
    const { deps, stream } = makeDeps(["Song 77 is a rain song."])
    const result = await runAssistantTurn(deps, {
      prompt: "Tell me about PS 77",
      history: [],
      sheetSong: 12,
      language: "auto",
    })
    expect(stream.mock.calls[0][0]).toBe(77)
    expect(result).toMatchObject({ grounding: { kind: "song", number: 77 } })
  })

  it("sends the language request to the API but shows the reader's own words", async () => {
    const seen: string[] = []
    const { deps } = makeDeps(["Haan, yeh geet prem ka hai."])
    deps.stream = async (_s, onChunk, prompt) => {
      seen.push(prompt)
      onChunk("A calm song.")
    }
    const begin = vi.fn(() => "a-1")
    deps.beginExchange = begin
    await runAssistantTurn(deps, {
      prompt: "What is PS 12 about?",
      history: [],
      sheetSong: 12,
      language: "hindi",
    })
    expect(seen[0]).toBe("What is PS 12 about? Answer in Hindi.")
    expect(begin).toHaveBeenCalledWith("What is PS 12 about?")
  })

  it("an empty stream becomes an honest notice and is not saved", async () => {
    const { deps, saveMemory } = makeDeps([])
    const result = await runAssistantTurn(deps, {
      prompt: "Explain PS 12",
      history: [],
      sheetSong: null,
      language: "auto",
    })
    expect(result).toMatchObject({ status: "done", kind: "notice" })
    expect(saveMemory).not.toHaveBeenCalled()
  })

  it("a server quota reply is reported as quota and not saved", async () => {
    const { deps, saveMemory } = makeDeps([
      "You have reached today's guest limit of 15 AI companion questions. Sign in for up to 50 questions per day, or come back tomorrow.",
    ])
    const result = await runAssistantTurn(deps, {
      prompt: "Explain PS 12",
      history: [],
      sheetSong: 12,
      language: "auto",
    })
    expect(result).toMatchObject({ kind: "quota" })
    expect(saveMemory).not.toHaveBeenCalled()
  })

  it("a network failure becomes a plain notice", async () => {
    const { deps, updates } = makeDeps([], { throws: new Error("Network request failed") })
    const result = await runAssistantTurn(deps, {
      prompt: "Explain PS 12",
      history: [],
      sheetSong: 12,
      language: "auto",
    })
    expect(result).toMatchObject({ kind: "notice" })
    expect(updates.at(-1)).toMatch(/offline/)
  })

  it("ignores an empty prompt", async () => {
    const { deps } = makeDeps([])
    expect(
      await runAssistantTurn(deps, { prompt: "  ", history: [], sheetSong: 1, language: "auto" }),
    ).toEqual({ status: "ignored" })
  })
})

describe("buildHistory", () => {
  it("keeps questions and real answers, drops notices and blanks, caps at 12", () => {
    const turns = [
      { role: "user" as const, text: "What is PS 12 about?" },
      { role: "assistant" as const, text: "Song not found." },
      { role: "assistant" as const, text: "" },
      { role: "assistant" as const, text: "A song of longing." },
    ]
    expect(buildHistory(turns)).toEqual([
      { role: "user", content: "What is PS 12 about?" },
      { role: "assistant", content: "A song of longing." },
    ])
    const many = Array.from({ length: 30 }, (_, i) => ({ role: "user" as const, text: `q${i}` }))
    expect(buildHistory(many)).toHaveLength(12)
  })
})

describe("friendlyError", () => {
  it("maps abort and network errors", () => {
    const abort = new Error("Aborted")
    abort.name = "AbortError"
    expect(friendlyError(abort)).toMatch(/too long/)
    expect(friendlyError(new Error("Network request failed"))).toMatch(/offline/)
    expect(friendlyError("x")).toMatch(/temporarily unavailable/)
  })
})

function thread(id: string, updatedAt: number, songNumber: number | null, questions = 1): ChatThread {
  return {
    id,
    title: id,
    updatedAt,
    songNumber,
    messages: Array.from({ length: questions }, (_, i) => ({
      id: `${id}-${i}`,
      role: "user" as const,
      text: "q",
      createdAt: updatedAt,
    })),
  }
}

describe("assistant history", () => {
  const now = new Date(2026, 10, 3, 15, 0).getTime()
  const hour = 3_600_000

  it("keeps only non-empty threads of one scope, newest first", () => {
    const threads = [
      thread("old", now - 5 * hour, 12),
      thread("new", now - hour, 12),
      thread("other", now, 99),
      { ...thread("empty", now, 12), messages: [] },
      thread("global", now, null),
    ]
    expect(threadsForScope(threads, 12).map((t) => t.id)).toEqual(["new", "old"])
    expect(threadsForScope(threads, null).map((t) => t.id)).toEqual(["global"])
  })

  it("groups by day with Today and Yesterday labels", () => {
    const groups = groupThreadsByDay(
      [
        thread("a", now - hour, null),
        thread("b", now - 2 * hour, null),
        thread("c", now - 24 * hour, null),
        thread("d", now - 24 * 6 * hour, null),
      ],
      now,
    )
    expect(groups.map((g) => g.label).slice(0, 2)).toEqual(["Today", "Yesterday"])
    expect(groups[0].threads.map((t) => t.id)).toEqual(["a", "b"])
    expect(groups).toHaveLength(3)
  })

  it("counts questions in words", () => {
    expect(questionCountLabel(thread("a", now, null, 1))).toBe("1 question")
    expect(questionCountLabel(thread("a", now, null, 3))).toBe("3 questions")
  })
})
