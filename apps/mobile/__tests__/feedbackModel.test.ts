import { describe, expect, it } from "vitest"

import {
  FEEDBACK_KINDS,
  MAX_MESSAGE,
  apiCategoryFor,
  apiRatingFor,
  buildComment,
  buildPagePath,
  buildRequest,
  canSend,
  clampMessage,
  counterText,
  emailProblem,
  formatAppDetails,
  friendlyError,
  messageHelper,
  messageReady,
  parseSongParam,
  songLabel,
  type FeedbackForm,
} from "@/lib/feedback/model"

const base: FeedbackForm = {
  kind: "broken",
  message: "The player stops after one song.",
  song: null,
  email: "",
  accountEmail: null,
  includeAppDetails: true,
  appDetails: { appVersion: "1.4.0", os: "ios", osVersion: "19.1", device: "iPhone 17" },
}

describe("kinds", () => {
  it("has the four choices in order", () => {
    expect(FEEDBACK_KINDS.map((k) => k.label)).toEqual([
      "Something is broken",
      "An idea",
      "A mistake in a song or lyrics",
      "Something else",
    ])
  })
  it("maps to categories the endpoint accepts", () => {
    expect(apiCategoryFor("broken")).toBe("experience")
    expect(apiCategoryFor("idea")).toBe("experience")
    expect(apiCategoryFor("song")).toBe("content")
    expect(apiCategoryFor("other")).toBe("other")
    for (const k of FEEDBACK_KINDS) {
      const rating = apiRatingFor(k.id)
      expect(rating).toBeGreaterThanOrEqual(1)
      expect(rating).toBeLessThanOrEqual(5)
    }
    expect(apiRatingFor("broken")).toBe(2)
  })
})

describe("message", () => {
  it("is ready from 10 characters, ignoring surrounding spaces", () => {
    expect(messageReady("123456789")).toBe(false)
    expect(messageReady("1234567890")).toBe(true)
    expect(messageReady("   123456789   ")).toBe(false)
  })
  it("counts and clamps", () => {
    expect(counterText("abc")).toBe(`3 / ${MAX_MESSAGE}`)
    expect(clampMessage("x".repeat(MAX_MESSAGE + 50))).toHaveLength(MAX_MESSAGE)
    expect(counterText("x".repeat(MAX_MESSAGE + 50))).toBe(`${MAX_MESSAGE} / ${MAX_MESSAGE}`)
  })
  it("helps until long enough", () => {
    expect(messageHelper("")).toBe("Write at least 10 characters so we can understand it.")
    expect(messageHelper("abcdefg")).toBe("3 more characters to go.")
    expect(messageHelper("abcdefghi")).toBe("1 more character to go.")
    expect(messageHelper("abcdefghij")).toBeNull()
  })
})

describe("email", () => {
  it("accepts empty and plausible addresses", () => {
    expect(emailProblem("")).toBeNull()
    expect(emailProblem("  ")).toBeNull()
    expect(emailProblem("a@b.org")).toBeNull()
  })
  it("rejects the rest", () => {
    expect(emailProblem("nope")).not.toBeNull()
    expect(emailProblem("a@b")).not.toBeNull()
    expect(emailProblem("a b@c.com")).not.toBeNull()
  })
})

describe("song param", () => {
  it("reads numbers and ps- forms", () => {
    expect(parseSongParam("12")).toBe(12)
    expect(parseSongParam("ps-12")).toBe(12)
    expect(parseSongParam("PS 5018")).toBe(5018)
    expect(parseSongParam(["7", "9"])).toBe(7)
  })
  it("ignores junk", () => {
    expect(parseSongParam(undefined)).toBeNull()
    expect(parseSongParam("")).toBeNull()
    expect(parseSongParam("0")).toBeNull()
    expect(parseSongParam("abc")).toBeNull()
    expect(parseSongParam("123456")).toBeNull()
  })
  it("labels a song", () => {
    expect(songLabel({ number: 1, title: "Bandhu He Niye Calo" })).toBe("PS 1 · Bandhu He Niye Calo")
    expect(songLabel({ number: 1, title: "" })).toBe("PS 1")
  })
})

describe("app details line", () => {
  it("joins what is known", () => {
    expect(formatAppDetails(base.appDetails)).toBe("App 1.4.0 · iOS 19.1 · iPhone 17")
    expect(formatAppDetails({ appVersion: "2.0", os: "web" })).toBe("App 2.0 · Web")
    expect(formatAppDetails({})).toBe("")
  })
})

describe("request", () => {
  it("builds the payload with kind and app lines", () => {
    const req = buildRequest(base)!
    expect(req.category).toBe("experience")
    expect(req.rating).toBe(2)
    expect(req.page_path).toBe("/mobile/feedback")
    expect(req.contact).toBeUndefined()
    expect(req.comment).toBe(
      "The player stops after one song.\n\nKind: Something is broken\nApp details: App 1.4.0 · iOS 19.1 · iPhone 17",
    )
    expect(req.comment.length).toBeLessThanOrEqual(2000)
  })
  it("leaves the app line out when the switch is off", () => {
    expect(buildComment({ ...base, includeAppDetails: false })).not.toContain("App details")
  })
  it("adds the song and points at its page", () => {
    const form: FeedbackForm = { ...base, kind: "song", song: { number: 12, title: "Sample" } }
    expect(buildComment(form)).toContain("Song: PS 12 · Sample")
    expect(buildPagePath(form)).toBe("/songs/12")
    expect(buildRequest(form)!.category).toBe("content")
  })
  it("ignores a song that was picked and then another kind chosen", () => {
    const form: FeedbackForm = { ...base, kind: "idea", song: { number: 12, title: "Sample" } }
    expect(buildComment(form)).not.toContain("Song:")
    expect(buildPagePath(form)).toBe("/mobile/feedback")
  })
  it("uses the typed email for guests and the account email for members", () => {
    expect(buildRequest({ ...base, email: " me@x.org " })!.contact).toBe("me@x.org")
    expect(buildRequest({ ...base, email: "ignored", accountEmail: "acct@x.org" })!.contact).toBe("acct@x.org")
  })
  it("refuses a short message or a bad typed email", () => {
    expect(buildRequest({ ...base, message: "short" })).toBeNull()
    expect(buildRequest({ ...base, email: "bad" })).toBeNull()
  })
  it("canSend follows the same rules", () => {
    expect(canSend(base)).toBe(true)
    expect(canSend({ ...base, message: "short" })).toBe(false)
    expect(canSend({ ...base, email: "bad" })).toBe(false)
    expect(canSend({ ...base, email: "bad", accountEmail: "a@b.org" })).toBe(true)
  })
})

describe("friendlyError", () => {
  it("says so when there is no connection", () => {
    expect(friendlyError(new TypeError("Network request failed"))).toMatch(/No connection/)
    expect(friendlyError(undefined)).toMatch(/No connection/)
  })
  it("passes server details through", () => {
    expect(friendlyError(new Error("Thank you. Please wait before sending more feedback."))).toBe(
      "Thank you. Please wait before sending more feedback.",
    )
  })
})
