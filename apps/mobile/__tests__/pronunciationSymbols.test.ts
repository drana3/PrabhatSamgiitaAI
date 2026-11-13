import { describe, expect, it } from "vitest"

import { buildMemo, ruleOccurs } from "@/lib/pronunciation/memo"
import { normalizeRoman, tokensInRoman } from "@/lib/pronunciation/symbols"
import { ALL_RULES, BENGALI_RULES, SANSKRIT_RULES } from "@/data/pronunciation"

// the retroflex t and d are a letter plus a combining acute in the catalogue
const T_ACUTE = "t́"
const D_ACUTE = "d́"

describe("tokensInRoman: the symbols of a song's Roman text", () => {
  it("reads digraphs as one symbol and not as two letters", () => {
    const tokens = tokensInRoman("Khelá, ghum, bhálo, shudhu")
    expect(tokens.has("kh")).toBe(true)
    expect(tokens.has("gh")).toBe(true)
    expect(tokens.has("bh")).toBe(true)
    expect(tokens.has("sh")).toBe(true)
    expect(tokens.has("dh")).toBe(true)
    // shudhu has no separate s, no separate h beyond the digraphs
    expect(tokens.has("s")).toBe(false)
    expect(tokens.has("h")).toBe(false)
  })

  it("reads the retroflex t and d (a letter plus a combining acute), also with an aspirate", () => {
    const tokens = tokensInRoman(`${T_ACUTE}áne ut${"́"}he ${D_ACUTE}eke ${D_ACUTE}hele`)
    expect(tokens.has(T_ACUTE)).toBe(true)
    expect(tokens.has(`${T_ACUTE}h`)).toBe(true)
    expect(tokens.has(D_ACUTE)).toBe(true)
    expect(tokens.has(`${D_ACUTE}h`)).toBe(true)
    // the plain dental t and d are not claimed by the retroflex ones
    expect(tokens.has("t")).toBe(false)
    expect(tokens.has("d")).toBe(false)
  })

  it("is case-insensitive and normalises the text", () => {
    expect(normalizeRoman("ÁMI")).toBe("ámi")
    expect(tokensInRoman("ÁMI").has("á")).toBe(true)
    // the same letter decomposed (a + combining acute) is still the one symbol
    expect(tokensInRoman("ámi").has("á")).toBe(true)
  })

  it("finds long vowels and the other digraphs of the key", () => {
    const tokens = tokensInRoman("jiivan dúre taeri saorabha kśudra gyán")
    for (const token of ["ii", "ú", "ae", "ao", "kś", "gy"]) expect(tokens.has(token), token).toBe(true)
  })

  it("finds a visarga h only after a vowel, at the end of a word or before a consonant", () => {
    expect(tokensInRoman("namah").has("@visarga")).toBe(true)
    expect(tokensInRoman("duhkhe").has("@visarga")).toBe(true)
    expect(tokensInRoman("puruśottamah").has("@visarga")).toBe(true)
    // the h of kh, sh, bh and the h between vowels are not a visarga
    expect(tokensInRoman("khelá bhálo shudhu ahaḿ mahá").has("@visarga")).toBe(false)
  })

  it("finds diphthongs, un/in for the nasals, and the ya-phala and ba-phala", () => {
    expect(tokensInRoman("sabái").has("@diph")).toBe(true)
    expect(tokensInRoman("tomár").has("@diph")).toBe(false)
    // ii is a long vowel, not a diphthong
    expect(tokensInRoman("jiivan").has("@diph")).toBe(false)
    expect(tokensInRoman("saunge").has("@nga")).toBe(true)
    expect(tokensInRoman("shaunkara").has("@nga")).toBe(true)
    expect(tokensInRoman("jhainjhá").has("@nya")).toBe(true)
    expect(tokensInRoman("vyathá").has("@yphala")).toBe(true)
    expect(tokensInRoman("lakśya").has("@yphala")).toBe(true)
    expect(tokensInRoman("priya").has("@yphala")).toBe(false)
    expect(tokensInRoman("jáy").has("@yphala")).toBe(false)
    expect(tokensInRoman("vishva").has("@vphala")).toBe(true)
    expect(tokensInRoman("svapane").has("@vphala")).toBe(true)
    expect(tokensInRoman("tava").has("@vphala")).toBe(false)
  })

  it("does not fail on empty or odd text", () => {
    expect(tokensInRoman("").size).toBe(0)
    expect(tokensInRoman("— 12 ... ?!").size).toBe(0)
  })
})

describe("buildMemo: the order of the memo", () => {
  const roman = ["Ámi tomár kathá shuni", "Shudhu tumi", "Phúl dekhi"].join("\n")

  it("puts the basics first, the symbols of this song second, the rest last, with no rule twice", () => {
    for (const language of ["bengali", "sanskrit"] as const) {
      const memo = buildMemo(language, roman)
      const rules = language === "bengali" ? BENGALI_RULES : SANSKRIT_RULES
      expect(memo.general.every((rule) => rule.group === "general")).toBe(true)
      const ids = [...memo.general, ...memo.inSong, ...memo.others].map((rule) => rule.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect([...ids].sort()).toEqual(rules.map((rule) => rule.id).sort())
    }
  })

  it("lists in the second block exactly the rules whose symbols occur, in the order of the rule list", () => {
    const memo = buildMemo("bengali", roman)
    const ids = memo.inSong.map((rule) => rule.id)
    expect(ids).toContain("bn.a")
    expect(ids).toContain("bn.aa")
    expect(ids).toContain("bn.u")
    expect(ids).toContain("bn.sh")
    expect(ids).toContain("bn.velar")
    // not in the text
    expect(ids).not.toContain("bn.retroflex")
    expect(ids).not.toContain("bn.kss")
    const order = BENGALI_RULES.map((rule) => rule.id)
    expect(ids).toEqual([...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b)))
    const tokens = tokensInRoman(roman)
    expect(memo.inSong.every((rule) => ruleOccurs(rule, tokens))).toBe(true)
    expect(memo.others.every((rule) => !ruleOccurs(rule, tokens))).toBe(true)
  })

  it("moves a rule to the first block when the song gets its symbol", () => {
    const without = buildMemo("bengali", "Ámi tumi")
    const withKss = buildMemo("bengali", "Ámi kśudra")
    expect(without.inSong.map((rule) => rule.id)).not.toContain("bn.kss")
    expect(withKss.inSong.map((rule) => rule.id)).toContain("bn.kss")
    expect(withKss.others.map((rule) => rule.id)).not.toContain("bn.kss")
  })

  it("keeps rules that cannot be told from the text in the last block", () => {
    const memo = buildMemo("bengali", roman)
    const blind = ALL_RULES.filter((rule) => rule.language === "bengali" && rule.group !== "general" && rule.tokens.length === 0)
    for (const rule of blind) expect(memo.others.map((r) => r.id)).toContain(rule.id)
  })

  it("handles a song with no text", () => {
    const memo = buildMemo("sanskrit", null)
    expect(memo.inSong).toEqual([])
    expect(memo.general.length).toBeGreaterThan(0)
  })
})
