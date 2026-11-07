import { rulesOf } from "@/data/pronunciation"
import type { PronLanguage, PronRule } from "@/data/pronunciation/types"
import { tokensInRoman } from "./symbols"

/** What the sheet shows for one language, in this order: the short general block, the symbols of this song, the rest. */
export type Memo = {
  language: PronLanguage
  general: PronRule[]
  /** rules whose symbols occur in the song, in the order of the rule list */
  inSong: PronRule[]
  /** all other rules (including those that cannot be told from the text) */
  others: PronRule[]
}

/** Does the rule have a symbol in this set of tokens? A rule with no tokens can never be told from the text. */
export function ruleOccurs(rule: PronRule, tokens: ReadonlySet<string>): boolean {
  return rule.tokens.some((token) => tokens.has(token))
}

export function buildMemo(language: PronLanguage, roman: string | null | undefined): Memo {
  const tokens = tokensInRoman(roman ?? "")
  const all = rulesOf(language)
  const general = all.filter((rule) => rule.group === "general")
  const rest = all.filter((rule) => rule.group !== "general")
  return {
    language,
    general,
    inSong: rest.filter((rule) => ruleOccurs(rule, tokens)),
    others: rest.filter((rule) => !ruleOccurs(rule, tokens)),
  }
}
