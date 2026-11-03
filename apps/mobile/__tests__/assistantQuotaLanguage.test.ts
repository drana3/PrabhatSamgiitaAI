import { describe, expect, it } from "vitest"

import {
  currentQuota,
  dailyLimit,
  markQuotaExhausted,
  questionsLeft,
  quotaDayKey,
  quotaHelp,
  quotaLabel,
  recordQuestion,
} from "@/lib/assistantQuota"
import {
  ASSISTANT_LANGUAGES,
  isAssistantLanguage,
  languagePillLabel,
  promptWithLanguage,
} from "@/lib/assistantLanguage"

const monday = new Date("2026-11-02T10:00:00Z")
const tuesday = new Date("2026-11-03T00:30:00Z")

describe("assistant quota tally", () => {
  it("limits follow the guest and member daily limits", () => {
    expect(dailyLimit(false)).toBe(15)
    expect(dailyLimit(true)).toBe(50)
  })

  it("counts down as questions are recorded", () => {
    let state = recordQuestion(undefined, monday)
    state = recordQuestion(state, monday)
    expect(questionsLeft(state, 15, monday)).toBe(13)
    expect(quotaLabel(13)).toBe("13 questions left today")
    expect(quotaLabel(1)).toBe("1 question left today")
    expect(quotaLabel(0)).toBe("No questions left today")
  })

  it("resets on a new UTC day", () => {
    const state = recordQuestion(undefined, monday)
    expect(currentQuota(state, tuesday)).toEqual({ day: quotaDayKey(tuesday), used: 0, exhausted: false })
    expect(questionsLeft(state, 15, tuesday)).toBe(15)
  })

  it("the server saying the limit is reached pins the count to zero", () => {
    const state = markQuotaExhausted(recordQuestion(undefined, monday), monday)
    expect(questionsLeft(state, 15, monday)).toBe(0)
    expect(questionsLeft(state, 15, tuesday)).toBe(15)
  })

  it("never goes below zero", () => {
    let state = undefined as ReturnType<typeof recordQuestion> | undefined
    for (let i = 0; i < 20; i++) state = recordQuestion(state, monday)
    expect(questionsLeft(state, 15, monday)).toBe(0)
  })

  it("offers a next step for guests and members", () => {
    expect(quotaHelp(false)).toMatch(/Sign in/)
    expect(quotaHelp(true)).not.toMatch(/Sign in/)
  })
})

describe("answer language", () => {
  it("auto leaves the prompt untouched", () => {
    expect(promptWithLanguage("What is PS 12 about?", "auto")).toBe("What is PS 12 about?")
  })

  it("adds an explicit request the backend recognises", () => {
    expect(promptWithLanguage("What is PS 12 about?", "hindi")).toBe(
      "What is PS 12 about? Answer in Hindi.",
    )
    expect(promptWithLanguage("What is PS 12 about?", "english")).toMatch(/Answer in English\.$/)
    expect(promptWithLanguage("What is PS 12 about?", "bengali")).toMatch(/Answer in Bengali\.$/)
  })

  it("does not override a language the reader asked for in the question", () => {
    expect(promptWithLanguage("Explain PS 12 in Hindi", "english")).toBe("Explain PS 12 in Hindi")
  })

  it("validates stored values and has a label for each option", () => {
    expect(isAssistantLanguage("hindi")).toBe(true)
    expect(isAssistantLanguage("klingon")).toBe(false)
    expect(ASSISTANT_LANGUAGES.map((l) => l.id)).toEqual(["auto", "english", "hindi", "bengali"])
    expect(languagePillLabel("auto")).toBe("Auto")
    expect(languagePillLabel("hindi")).toBe("Hindi")
  })
})
