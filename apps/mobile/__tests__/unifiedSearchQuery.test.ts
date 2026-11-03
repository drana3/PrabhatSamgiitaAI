import { describe, expect, it } from "vitest"

import {
  classifyQuery,
  detectFeelings,
  FEELINGS,
  hintLine,
  HINT_EXAMPLES,
  looksLikeQuestion,
  parseHint,
  parseSearchParams,
  reasonFromHit,
  reasonLabel,
  SEARCH_EXAMPLES,
  shouldShowAnswer,
  withoutRecent,
} from "@/lib/unifiedSearchQuery"
import { TODAY_FIND_ROWS } from "@/lib/todayView"

describe("classifyQuery", () => {
  it("reads the four spec examples from one field", () => {
    expect(classifyQuery("3")).toMatchObject({ kind: "number", number: 3, outOfRange: false })
    expect(classifyQuery("bandhu he niye calo").kind).toBe("words")
    expect(classifyQuery("friend").kind).toBe("words")
    const feeling = classifyQuery("peaceful devotion")
    expect(feeling.kind).toBe("feeling")
    expect(feeling.feelings.map((f) => f.moodId)).toEqual(["peace", "devotional"])
  })

  it("accepts PS prefixes and flags numbers outside 1 to 5018", () => {
    expect(classifyQuery("PS 111")).toMatchObject({ kind: "number", number: 111 })
    expect(classifyQuery("ps-5018").outOfRange).toBe(false)
    expect(classifyQuery("0").outOfRange).toBe(true)
    expect(classifyQuery("5019").outOfRange).toBe(true)
  })

  it("treats an empty or blank field as empty", () => {
    expect(classifyQuery("").kind).toBe("empty")
    expect(classifyQuery("   ").kind).toBe("empty")
  })

  it("reads questions and keeps the feeling it mentions", () => {
    const q = classifyQuery("which song helps with stress?")
    expect(q.kind).toBe("question")
    expect(q.isQuestion).toBe(true)
    expect(q.feeling?.moodId).toBe("peace")
  })

  it("does not call a lyric line with one feeling word a feeling search", () => {
    expect(classifyQuery("alor oi jharana dharara pane love").kind).toBe("words")
  })
})

describe("detectFeelings", () => {
  it("is diacritic-insensitive and tolerates one typo", () => {
    expect(detectFeelings("PEACEFUL")[0]?.label).toBe("peaceful")
    expect(detectFeelings("peacful")[0]?.label).toBe("peaceful")
    expect(detectFeelings("bhakti")[0]?.moodId).toBe("devotional")
  })

  it("does not invent a feeling from a gloss word", () => {
    expect(detectFeelings("friend")).toEqual([])
    expect(detectFeelings("bandhu he niye calo")).toEqual([])
  })

  it("has no word listed under two feelings", () => {
    const seen = new Map<string, string>()
    for (const feeling of FEELINGS) {
      for (const word of feeling.words) {
        expect(seen.get(word), `${word} in ${feeling.label} and ${seen.get(word)}`).toBeUndefined()
        seen.set(word, feeling.label)
      }
    }
  })
})

describe("questions", () => {
  it("spots a question mark and interrogative openings", () => {
    expect(looksLikeQuestion("which song helps with calm")).toBe(true)
    expect(looksLikeQuestion("peaceful songs?")).toBe(true)
    expect(looksLikeQuestion("bandhu he niye calo")).toBe(false)
    expect(looksLikeQuestion("12")).toBe(false)
  })

  it("shows the Answer card for long text only when nothing matched by words", () => {
    const long = "a song for a quiet evening after a long hard day at work"
    expect(shouldShowAnswer(long, 0)).toBe(true)
    expect(shouldShowAnswer(long, 2)).toBe(false)
    expect(shouldShowAnswer("peaceful", 0)).toBe(false)
    expect(shouldShowAnswer("", 0)).toBe(false)
  })
})

describe("hints from Today", () => {
  it("understands every href the Today rows open", () => {
    for (const row of TODAY_FIND_ROWS) {
      const params = Object.fromEntries(new URL(`https://x${row.href}`).searchParams)
      const parsed = parseSearchParams(params)
      expect(parsed.hint).toBe(row.id)
      expect(parsed.focus).toBe(true)
      expect(parsed.query).toBe(HINT_EXAMPLES[row.id])
      expect(parsed.prefilled).toBe(true)
    }
  })

  it("uses the three spec examples", () => {
    expect(SEARCH_EXAMPLES).toEqual(["3", "bandhu he niye calo", "peaceful"])
    expect(HINT_EXAMPLES).toEqual({ number: "3", words: "bandhu he niye calo", feeling: "peaceful" })
  })

  it("lets an explicit q win over a hint", () => {
    const parsed = parseSearchParams({ q: "111", hint: "feeling" })
    expect(parsed).toMatchObject({ query: "111", hint: "feeling", prefilled: false })
  })

  it("handles focus, listen and repeated params", () => {
    expect(parseSearchParams({}).focus).toBe(false)
    expect(parseSearchParams({ focus: "1" }).focus).toBe(true)
    expect(parseSearchParams({ listen: "1" }).listen).toBe(true)
    expect(parseSearchParams({ listen: ["1", "0"] }).listen).toBe(true)
    expect(parseSearchParams({ hint: ["words", "number"] }).hint).toBe("words")
    expect(parseSearchParams({ q: "   " }).query).toBe("")
  })

  it("ignores an unknown hint", () => {
    expect(parseHint("shoes")).toBeNull()
    expect(parseHint(undefined)).toBeNull()
    expect(parseSearchParams({ hint: "shoes" })).toMatchObject({ hint: null, query: "", prefilled: false })
  })
})

describe("words around the field", () => {
  it("changes the hint line once the person types", () => {
    expect(hintLine("")).toBe("Type a number, a name or how you feel")
    expect(hintLine("3")).toBe("Searching numbers, names, words and feelings")
    expect(hintLine("", "number")).toContain("5018")
    expect(hintLine("x", "number")).toBe("Searching numbers, names, words and feelings")
  })

  it("labels each reason the way the spec says", () => {
    expect(reasonLabel({ kind: "number" })).toBe("Number match")
    expect(reasonLabel(reasonFromHit("opening_line"))).toBe("First line match")
    expect(reasonLabel(reasonFromHit("full_text"))).toBe("Word match")
    expect(reasonLabel(reasonFromHit("meaning"))).toBe("Word match")
    expect(reasonLabel({ kind: "feeling", feeling: "peaceful" })).toBe("Feeling: peaceful")
  })
})

describe("recents", () => {
  it("removes one entry without regard to case", () => {
    expect(withoutRecent(["Peace", "3"], "peace")).toEqual(["3"])
    expect(withoutRecent(["a"], "b")).toEqual(["a"])
  })
})
