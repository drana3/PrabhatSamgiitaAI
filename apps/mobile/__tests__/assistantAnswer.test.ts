import { describe, expect, it } from "vitest"

import {
  answerSources,
  classifyAnswer,
  extractSongRefs,
  groundingNumber,
  needsNoSourceCaution,
  resolveTurnGrounding,
} from "@/lib/assistantAnswer"
import { explicitSongNumberFromPrompt, resolveExplainSongNumber } from "@/lib/chat"

describe("classifyAnswer", () => {
  it("treats empty and placeholder text as empty", () => {
    expect(classifyAnswer("")).toBe("empty")
    expect(classifyAnswer("   ")).toBe("empty")
    expect(classifyAnswer("…")).toBe("empty")
    expect(classifyAnswer(null)).toBe("empty")
  })

  it("recognises the backend quota messages for guests and members", () => {
    expect(
      classifyAnswer(
        "You have reached today's guest limit of 15 AI companion questions. Sign in for up to 50 questions per day, or come back tomorrow.",
      ),
    ).toBe("quota")
    expect(
      classifyAnswer("You have reached today's signed-in limit of 50 AI companion questions."),
    ).toBe("quota")
  })

  it("recognises guard and error replies as notices, never answers", () => {
    const notices = [
      "Song not found.",
      "Streaming unavailable.",
      "I can help with Prabhat Samgiita songs, meanings, and spiritual themes. Please ask about a song or a related spiritual question.",
      "I can only share grounded guidance about this Prabhat Samgiita song — its meaning.\n\nSong 12: «X».",
      "I couldn’t find a grounded answer just now. Try naming a song number or opening a song first.",
      "The song companion is temporarily unavailable.",
      "Please ask something specific about Prabhat Samgiita, such as “Explain this song”.",
      "Prabhat Samgiita song numbers run from 1 to 5,018. Please enter a number within that range.",
      "There is no grounded answer for that. Try naming a song number, or open a song first.",
      "That took too long. Please try again.",
    ]
    for (const text of notices) expect(classifyAnswer(text)).toBe("notice")
  })

  it("treats a normal explanation as an answer", () => {
    expect(classifyAnswer("PS 12 is a song of longing for the Beloved.")).toBe("answer")
  })
})

describe("extractSongRefs", () => {
  it("finds PS numbers in several spellings, once each, in order", () => {
    expect(extractSongRefs("Compare PS 12 with song 340, then PS-12 again and Prabhat Samgiita 7.")).toEqual([
      12, 340, 7,
    ])
  })

  it("ignores numbers outside the catalogue and bare numbers", () => {
    expect(extractSongRefs("PS 0 and PS 9999 and 2024 are not songs")).toEqual([])
    expect(extractSongRefs("He sang for 40 minutes")).toEqual([])
  })
})

describe("answerSources", () => {
  it("puts the grounded song first and adds mentioned songs", () => {
    expect(
      answerSources({ text: "Like PS 340, this song waits.", groundedNumber: 12 }),
    ).toEqual([
      { number: 12, role: "grounded" },
      { number: 340, role: "mentioned" },
    ])
  })

  it("does not repeat the grounded song when the answer names it", () => {
    expect(answerSources({ text: "PS 12 says it plainly.", groundedNumber: 12 })).toEqual([
      { number: 12, role: "grounded" },
    ])
  })

  it("caps the list at four", () => {
    const text = "PS 1, PS 2, PS 3, PS 4, PS 5, PS 6"
    expect(answerSources({ text, groundedNumber: 9 })).toHaveLength(4)
  })

  it("fails closed: notices, quota and empty replies carry no sources", () => {
    expect(answerSources({ text: "Song not found.", groundedNumber: 12 })).toEqual([])
    expect(
      answerSources({
        text: "You have reached today's guest limit of 15 AI companion questions.",
        groundedNumber: 12,
      }),
    ).toEqual([])
    expect(answerSources({ text: "", groundedNumber: 12 })).toEqual([])
  })

  it("flags an answer that cites nothing", () => {
    expect(needsNoSourceCaution({ text: "A calm morning song.", groundedNumber: null })).toBe(true)
    expect(needsNoSourceCaution({ text: "A calm morning song.", groundedNumber: 5 })).toBe(false)
    expect(needsNoSourceCaution({ text: "Song not found.", groundedNumber: null })).toBe(false)
  })
})

describe("turn grounding", () => {
  it("prefers a number named in the question, then the sheet song", () => {
    expect(resolveTurnGrounding(77, 12)).toEqual({ kind: "song", number: 77 })
    expect(resolveTurnGrounding(null, 12)).toEqual({ kind: "song", number: 12 })
  })

  it("is catalogue-wide, not silently song 1, when nothing names a song", () => {
    const grounding = resolveTurnGrounding(null, null)
    expect(grounding).toEqual({ kind: "catalogue" })
    expect(groundingNumber(grounding)).toBeNull()
  })

  it("rejects a sheet song outside the catalogue", () => {
    expect(resolveTurnGrounding(null, 6000)).toEqual({ kind: "catalogue" })
  })
})

describe("explicitSongNumberFromPrompt (extracted from chat.ts)", () => {
  it("matches the behaviour resolveExplainSongNumber always had", () => {
    expect(explicitSongNumberFromPrompt("What is the meaning of song 2155?")).toBe(2155)
    expect(explicitSongNumberFromPrompt("3")).toBe(3)
    expect(explicitSongNumberFromPrompt("morning devotion")).toBeNull()
    expect(explicitSongNumberFromPrompt("song 9999")).toBeNull()
    expect(resolveExplainSongNumber("morning devotion", 1427)).toBe(1427)
    expect(resolveExplainSongNumber("morning devotion")).toBe(1)
  })
})
