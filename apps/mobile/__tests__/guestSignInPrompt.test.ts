import { describe, expect, it } from "vitest"

import { setActiveLanguage } from "@/lib/i18n"
import {
  GUEST_PROMPT_KINDS,
  GUEST_PROMPT_WEEK_MS,
  PROMPT_KEYS,
  SAVES_BEFORE_PROMPT,
  cleanPromptLog,
  promptAllowed,
  promptCopy,
  savesCallForPrompt,
} from "@/lib/guest/signInPrompt"
import { dictionaries } from "@/locales"

const DAY = 24 * 60 * 60 * 1000

describe("the weekly throttle", () => {
  it("allows a kind that was never shown", () => {
    expect(promptAllowed({}, "saves", 1_000)).toBe(true)
  })

  it("stays quiet for a full week, then allows again", () => {
    const shownAt = 10 * DAY
    expect(promptAllowed({ saves: shownAt }, "saves", shownAt + 6 * DAY + 23 * 3_600_000)).toBe(false)
    expect(promptAllowed({ saves: shownAt }, "saves", shownAt + GUEST_PROMPT_WEEK_MS - 1)).toBe(false)
    expect(promptAllowed({ saves: shownAt }, "saves", shownAt + GUEST_PROMPT_WEEK_MS)).toBe(true)
  })

  it("counts each kind on its own", () => {
    const log = { saves: 5 * DAY }
    expect(promptAllowed(log, "saves", 6 * DAY)).toBe(false)
    expect(promptAllowed(log, "upload", 6 * DAY)).toBe(true)
    expect(promptAllowed(log, "comment", 6 * DAY)).toBe(true)
  })

  it("is quiet when the phone's clock went back", () => {
    expect(promptAllowed({ upload: 100 * DAY }, "upload", 50 * DAY)).toBe(false)
  })

  it("reads a damaged stored log without crashing", () => {
    expect(cleanPromptLog(null)).toEqual({})
    expect(cleanPromptLog("x")).toEqual({})
    expect(cleanPromptLog({ saves: "yesterday", upload: 5, other: 9, comment: Number.NaN })).toEqual({ upload: 5 })
  })
})

describe("the 3rd saved song", () => {
  it("asks at three and after, not before", () => {
    expect(SAVES_BEFORE_PROMPT).toBe(3)
    expect([0, 1, 2].map(savesCallForPrompt)).toEqual([false, false, false])
    expect([3, 4, 20].map(savesCallForPrompt)).toEqual([true, true, true])
  })
})

describe("what the sheet says", () => {
  it("has a title, a second title line and a body for every kind in en, ru and es", () => {
    for (const language of ["en", "ru", "es"] as const) {
      for (const kind of GUEST_PROMPT_KINDS) {
        for (const key of Object.values(PROMPT_KEYS[kind])) {
          const text = (dictionaries[language] as Record<string, string>)[key]
          expect(text, `${language}:${key}`).toBeTruthy()
        }
      }
    }
  })

  it("says what the board says for saved songs", () => {
    setActiveLanguage("en")
    expect(promptCopy("saves")).toEqual({
      first: "Keep your",
      second: "saved songs",
      body: "As a guest, saved songs stay on this phone only. Sign in to keep them on every device.",
    })
  })

  it("names the reason for upload and for a comment, and never promises more than the app does", () => {
    setActiveLanguage("en")
    expect(promptCopy("upload")).toMatchObject({ first: "Sign in", second: "to upload" })
    expect(promptCopy("comment")).toMatchObject({ first: "Sign in", second: "to comment" })
    expect(promptCopy("upload").body).toMatch(/belongs to your account/)
    expect(promptCopy("comment").body).toMatch(/need an account/)
  })

  it("speaks the other languages", () => {
    setActiveLanguage("ru")
    expect(promptCopy("saves").first).toBe("Сохраните")
    setActiveLanguage("es")
    expect(promptCopy("comment").second).toBe("para comentar")
    setActiveLanguage("en")
  })
})
