import type { PronGroup, PronLanguage, PronRule, PronSample, RuleStatus } from "./types"

/** [roman, script, song] */
export type SampleSpec = readonly [roman: string, script: string, song: number]

/**
 * Builds one rule. The clip ids of its samples are `<rule id>.<n>` (1-based): `bn.a.1`, `bn.a.2`, ...
 * `verified` is always false here: a rule becomes verified only when a native speaker has confirmed it.
 */
export function rule(input: {
  id: string
  language: PronLanguage
  group: PronGroup
  symbols: string[]
  script: string[]
  ipa: string
  tokens?: string[]
  samples?: SampleSpec[]
  like?: boolean
  sources: string[]
  status?: RuleStatus
  checkNote?: string
}): PronRule {
  const samples: PronSample[] = (input.samples ?? []).map(([roman, script, song], i) => ({ roman, script, song, audio: `${input.id}.${i + 1}` }))
  return {
    id: input.id,
    language: input.language,
    group: input.group,
    symbols: input.symbols,
    script: input.script,
    ipa: input.ipa,
    tokens: input.tokens ?? [],
    samples,
    like: input.like ?? true,
    sources: input.sources,
    status: input.status ?? "sourced",
    verified: false,
    ...(input.checkNote ? { checkNote: input.checkNote } : {}),
  }
}
