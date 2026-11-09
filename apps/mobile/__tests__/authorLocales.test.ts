import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { LINK_KINDS, PROFILE_LANGUAGES } from "@/lib/authors/constants"
import { errorKey, problemKey } from "@/lib/authors/slug"
import { reasonKey } from "@/lib/authors/claims"
import { reviewKey } from "@/lib/authors/text"
import type { TeamReason } from "@/lib/authors/types"
import { LANGUAGES } from "@/lib/i18n/core"
import { dictionaries } from "@/locales"

/**
 * Every sentence the author pages ask for exists in English, Russian and Spanish: the literal keys found in the
 * source, and the families built at run time from a server code or a kind (these are listed here, so adding a code
 * without its sentence fails the build).
 */

const ROOT = join(__dirname, "..")
const DIRS = ["app", "components", "lib", "hooks", "stores"]

function files(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (name === "node_modules" || name === "__tests__") continue
    if (statSync(full).isDirectory()) out.push(...files(full))
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

function literalKeys(): Set<string> {
  const keys = new Set<string>()
  for (const dir of DIRS) {
    for (const file of files(join(ROOT, dir))) {
      const text = readFileSync(file, "utf8")
      for (const m of text.matchAll(/["'`](authors\.[A-Za-z0-9_.]+)["'`]/g)) keys.add(m[1] as string)
    }
  }
  return keys
}

function has(language: (typeof LANGUAGES)[number], key: string): boolean {
  const d = dictionaries[language] as Record<string, string>
  return key in d || `${key}_other` in d
}

const SLUG_CODES = ["too_short", "too_long", "characters", "needs_letter", "reserved", "taken", "quarantined", "cooldown", "protected"]
const API_ERROR_CODES = [
  "slug_too_short", "slug_too_long", "slug_characters", "slug_needs_letter", "slug_reserved", "slug_taken", "slug_quarantined",
  "slug_cooldown", "name_too_short", "text_has_link", "language_unknown", "already_exists", "suspended", "photo_empty",
  "photo_too_big", "photo_type", "link_scheme", "link_url", "link_host", "link_count", "link_repeat", "no_profile", "rate_limited",
  "bad_id", "alias_invalid", "alias_not_allowed", "alias_taken", "alias_limit", "alias_not_found",
  "claims_waiting", "claim_not_found", "claim_closed", "page_suspended",
]
// the server's TeamReason, ClaimStatus and MatchLevel (apps/api/app/schemas/author_claims.py)
const TEAM_REASONS = [
  "protected_name", "famous_name", "taken_by_other", "alias_match", "group_credit", "group_page", "not_same_name",
  "unverified_page", "draft_page", "review_flag",
]
const CLAIM_STATUSES = ["pending", "approved", "rejected", "withdrawn", "revoked"]
const MATCH_LEVELS = ["same", "alike", "title", "manual"]

function dynamicKeys(): string[] {
  const keys: string[] = []
  for (const s of ["draft", "published", "review", "suspended"]) keys.push(`authors.status.${s}`)
  for (const r of [null, "protected_name", "staff_name", "artist_claim", "look_alike_page", "look_alike_artist", "reported:spam", "unknown-code"]) keys.push(reviewKey(r))
  for (const n of ["counting_rule", "own_plays_excluded", "listener_estimate", "no_data_yet", "not_enough_data"]) keys.push(`authors.note.${n}`)
  for (const l of PROFILE_LANGUAGES) keys.push(`authors.language.${l}`)
  for (const k of LINK_KINDS) keys.push(`authors.link.${k}`)
  for (const r of ["impersonation", "offensive", "spam", "copyright", "wrong_info", "other"]) keys.push(`authors.report.reason.${r}`)
  for (const s of ["listeners", "new", "name"]) keys.push(`authors.dir.sort.${s}`)
  for (const r of TEAM_REASONS) keys.push(reasonKey(r as TeamReason))
  for (const c of CLAIM_STATUSES) keys.push(`authors.claims.status.${c}`)
  for (const l of MATCH_LEVELS) keys.push(`authors.find.level.${l}`)
  for (const step of [1, 2, 3, 4]) keys.push(`authors.become.step${step}.title`, `authors.become.step${step}.body`)
  for (const c of SLUG_CODES) keys.push(problemKey(c))
  for (const c of API_ERROR_CODES) keys.push(errorKey({ code: c }))
  keys.push(errorKey({ network: true }), errorKey({ status: 401 }), errorKey({ status: 429 }), errorKey({ status: 500 }))
  return keys
}

describe("author page sentences exist in every language", () => {
  const keys = new Set([...literalKeys(), ...dynamicKeys()])

  it("finds a believable number of keys (the scan itself works)", () => {
    expect(keys.size).toBeGreaterThan(150)
  })

  for (const language of LANGUAGES) {
    it(`has every key in ${language}`, () => {
      const missing = [...keys].filter((key) => key.includes("${") === false && !has(language, key))
      expect(missing).toEqual([])
    })
  }

  it("keeps the spelling rule: Kiirtan with two i, never Kirtan, in visible English text", () => {
    const en = dictionaries.en as Record<string, string>
    const bad = Object.entries(en).filter(([k, v]) => k.startsWith("authors.") && /\bKirtan/i.test(v) && !/Kiirtan/.test(v))
    expect(bad).toEqual([])
  })

  it("never puts a raw link in a sentence", () => {
    for (const language of LANGUAGES) {
      const d = dictionaries[language] as Record<string, string>
      for (const [k, v] of Object.entries(d)) if (k.startsWith("authors.")) expect(v, k).not.toMatch(/https?:\/\//)
    }
  })
})
