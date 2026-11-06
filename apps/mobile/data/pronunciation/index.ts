import { BENGALI_RULES } from "./bengali"
import { SANSKRIT_RULES } from "./sanskrit"
import type { PronLanguage, PronRule } from "./types"

export { BENGALI_RULES, SANSKRIT_RULES }
export { PRON_SOURCES } from "./sources"
export type { PronGroup, PronLanguage, PronRule, PronSample, PronSource, RuleStatus } from "./types"

export const ALL_RULES: readonly PronRule[] = [...BENGALI_RULES, ...SANSKRIT_RULES]

export function rulesOf(language: PronLanguage): readonly PronRule[] {
  return language === "bengali" ? BENGALI_RULES : SANSKRIT_RULES
}
