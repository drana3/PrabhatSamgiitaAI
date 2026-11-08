import type {
  Alias,
  AuthorProfileOwner,
  ClaimCandidate,
  ClaimList,
  ClaimOut,
  ClaimRecording,
  ClaimSearch,
  ClaimStatus,
  ClaimSuggestions,
  ClaimSummary,
  ClaimsCreated,
  ClaimResult,
  MatchLevel,
  TeamReason,
} from "@/lib/authors/types"
import { RemoteError } from "@/lib/kirtan/remote"

/**
 * "Claim my recordings" for the web preview: the same calls as lib/authors/remote.ts, answered from a few invented
 * library recordings. The matching here is a small copy of the server's idea (a name written another way is still the
 * same name; a longer name that contains yours is only alike), enough to show every state of the screens. The real
 * rules live in apps/api/app/services/author_claim_rules.py and author_claims.py.
 */

const NOW = "2026-11-01T10:00:00Z"

function rec(id: string, kind: string, title: string, author: string, addedBy: string, library: boolean, durationSec: number, plays: number): ClaimRecording {
  return { id, kind, title, author, added_by: addedBy, library, duration_sec: durationSec, plays }
}

/** Invented recordings of the shared library. The names are the demo author's, written the ways people write them. */
export const DEMO_LIBRARY: ClaimRecording[] = [
  rec("lib-1", "kiirtan", "Baba Nam Kevalam, evening round", "Priya Devi", "Library", true, 1260, 410),
  rec("lib-2", "kiirtan", "Ananda Marga jayate, slow", "Priya Dewi", "Anil K.", false, 940, 120),
  rec("lib-3", "prabhat_samgiita", "Prabhat Samgiita 1234", "Priya Devi & friends", "Library", true, 312, 85),
  rec("lib-4", "bhajan", "Sharing the light", "Priya Devi Sharma", "Mira T.", false, 288, 40),
  rec("lib-5", "kiirtan", "Night kiirtan with Priya Devi", "Unknown", "Anil K.", false, 2210, 17),
  rec("lib-6", "kiirtan", "Hari haraye namah", "Dhiraj Kumar", "Library", true, 700, 260),
  rec("lib-7", "bhajan", "Morning bhajan", "Radha Songs", "Mira T.", false, 240, 9),
]

/** The comparable form of a name: sounds that people spell in more than one way become one. */
function key(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]+/g, "")
    .replace(/sh/g, "s")
    .replace(/dh/g, "d")
    .replace(/w/g, "v")
    .replace(/y/g, "i")
    .replace(/(.)\1+/g, "$1")
}

function split(credit: string): string[] {
  return credit
    .split(/\s*(?:,|;|&|\+|\/|\band\b|\bwith\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean)
}

function levelOf(credit: string, names: string[]): { level: MatchLevel; text: string } | null {
  let best: { level: MatchLevel; text: string } | null = null
  for (const part of split(credit)) {
    for (const name of names) {
      const a = key(part)
      const b = key(name)
      if (!a || !b) continue
      if (a === b) return { level: "same", text: part }
      const [short, long] = a.length <= b.length ? [a, b] : [b, a]
      if (!best && short.length >= 6 && long.includes(short)) best = { level: "alike", text: part }
    }
  }
  return best
}

type Held = { id: string; recordingId: string; level: MatchLevel; text: string; route: "self" | "team"; status: ClaimStatus; reason: TeamReason | null; note: string | null; createdAt: string; decidedAt: string | null }

export type DemoClaims = ReturnType<typeof createDemoClaims>

export function createDemoClaims(getMine: () => AuthorProfileOwner | null) {
  let mode: "some" | "none" = "some"
  let claims: Held[] = []
  let extra: Alias[] = []
  let paused: string | null = null
  let counter = 0

  const library = () => (mode === "none" ? [] : DEMO_LIBRARY)
  const names = (): string[] => {
    const mine = getMine()
    return mine ? [mine.display_name, ...(mine.claimed_name ? [mine.claimed_name] : []), ...extra.map((a) => a.alias)] : []
  }
  const heldFor = (recordingId: string) => claims.find((c) => c.recordingId === recordingId && (c.status === "pending" || c.status === "approved"))

  /** Where a claim would go: approved at once only for a verified, published page and a clear same-name solo credit. */
  function routeOf(credit: string, level: MatchLevel): { route: "self" | "team"; reason: TeamReason | null } {
    const mine = getMine()
    if (!mine) return { route: "team", reason: "draft_page" }
    if (mine.status !== "published") return { route: "team", reason: "draft_page" }
    if (!mine.verified) return { route: "team", reason: "unverified_page" }
    if (mine.author_type === "group") return { route: "team", reason: "group_page" }
    if (split(credit).length > 1) return { route: "team", reason: "group_credit" }
    if (level !== "same") return { route: "team", reason: "not_same_name" }
    return { route: "self", reason: null }
  }

  function candidate(recording: ClaimRecording, level: MatchLevel, text: string): ClaimCandidate {
    const held = heldFor(recording.id)
    const { route, reason } = routeOf(recording.author, level)
    return { recording, level, matched_text: text, route, team_reason: reason, claim_status: held?.status ?? null, claim_id: held?.id ?? null }
  }

  function suggestions(): ClaimSuggestions {
    const list = names()
    const same: ClaimCandidate[] = []
    const alike: ClaimCandidate[] = []
    for (const r of library()) {
      const m = levelOf(r.author, list)
      if (!m) continue
      const c = candidate(r, m.level, m.text)
      if (m.level === "same") same.push(c)
      else alike.push(c)
    }
    return { names: list, same, alike, total: same.length + alike.length }
  }

  const out = (c: Held): ClaimOut => {
    const recording = DEMO_LIBRARY.find((r) => r.id === c.recordingId) as ClaimRecording
    return { id: c.id, recording, level: c.level, matched_text: c.text, route: c.route, status: c.status, team_reason: c.reason, decision_note: c.note, created_at: c.createdAt, decided_at: c.decidedAt }
  }

  return {
    setMode(next: "some" | "none") {
      mode = next
    },
    /** put the claims of the person into a state (a screenshot script or a test) */
    setClaims(rows: { recordingId: string; status: ClaimStatus; reason?: TeamReason | null; note?: string | null }[]) {
      claims = rows.map((r, i) => {
        const recording = DEMO_LIBRARY.find((x) => x.id === r.recordingId)
        return {
          id: `demo-claim-${i + 1}`,
          recordingId: r.recordingId,
          level: "same" as MatchLevel,
          text: recording?.author ?? "",
          route: "team" as const,
          status: r.status,
          reason: r.reason ?? (r.status === "pending" ? "unverified_page" : null),
          note: r.note ?? null,
          createdAt: NOW,
          decidedAt: r.status === "pending" ? null : NOW,
        }
      })
      counter = claims.length
    },
    setPaused(until: string | null) {
      paused = until
    },
    reset() {
      mode = "some"
      claims = []
      extra = []
      paused = null
      counter = 0
    },
    api: {
      async claimSummary(): Promise<ClaimSummary> {
        const s = suggestions()
        const open = [...s.same, ...s.alike].filter((c) => c.claim_status === null).length
        return { suggested: open, pending: claims.filter((c) => c.status === "pending").length, approved: claims.filter((c) => c.status === "approved").length, paused_until: paused }
      },
      async claimSuggestions(): Promise<ClaimSuggestions> {
        return suggestions()
      },
      async claimSearch(q: string, offset = 0): Promise<ClaimSearch> {
        const needle = key(q)
        const items: ClaimCandidate[] = []
        if (needle.length >= 2) {
          for (const r of library()) {
            const credit = key(r.author)
            const title = key(r.title)
            if (credit === needle) items.push(candidate(r, "same", r.author))
            else if (credit.includes(needle) || needle.includes(credit)) items.push(candidate(r, "alike", r.author))
            else if (title.includes(needle)) items.push(candidate(r, "title", r.title))
          }
        }
        const page = items.slice(offset, offset + 30)
        return { query: q.trim(), items: page, total: items.length, has_more: offset + 30 < items.length }
      },
      async createClaims(ids: string[]): Promise<ClaimsCreated> {
        if (paused) throw new RemoteError(429, "Claiming is paused for now", { code: "claims_paused" })
        const results: ClaimResult[] = []
        let approved = 0
        let pending = 0
        for (const id of ids) {
          const r = library().find((x) => x.id === id)
          if (!r) {
            results.push({ recording_id: id, outcome: "not_found", claim_id: null, team_reason: null })
            continue
          }
          const held = heldFor(id)
          if (held) {
            results.push({ recording_id: id, outcome: held.status === "approved" ? "already_approved" : "already_pending", claim_id: held.id, team_reason: held.reason })
            continue
          }
          const m = levelOf(r.author, names())
          const level: MatchLevel = m ? m.level : key(r.title).includes(key(names()[0] ?? "")) ? "title" : "manual"
          const { route, reason } = routeOf(r.author, level)
          const claim: Held = { id: `demo-claim-${++counter}`, recordingId: id, level, text: m?.text ?? r.author, route, status: route === "self" ? "approved" : "pending", reason, note: null, createdAt: NOW, decidedAt: route === "self" ? NOW : null }
          claims = [claim, ...claims.filter((c) => c.recordingId !== id)]
          if (route === "self") approved += 1
          else pending += 1
          results.push({ recording_id: id, outcome: route === "self" ? "approved" : "pending", claim_id: claim.id, team_reason: reason })
        }
        return { results, approved, pending }
      },
      async myClaims(status?: ClaimStatus): Promise<ClaimList> {
        const items = claims.filter((c) => !status || c.status === status).map(out)
        return { items, total: items.length }
      },
      async withdrawClaim(id: string): Promise<void> {
        const c = claims.find((x) => x.id === id)
        if (!c) throw new RemoteError(404, "Claim not found", { code: "claim_not_found" })
        if (c.status !== "pending" && c.status !== "approved") throw new RemoteError(409, "This claim is already closed", { code: "claim_closed" })
        c.status = "withdrawn"
        c.decidedAt = NOW
      },
      async aliases(): Promise<Alias[]> {
        return extra
      },
      async addAlias(alias: string): Promise<Alias[]> {
        const clean = alias.trim()
        if (!clean) throw new RemoteError(422, "Write a name", { code: "alias_invalid" })
        if (extra.length >= 5) throw new RemoteError(422, "Too many names", { code: "alias_limit" })
        if (!extra.some((a) => a.key === key(clean))) extra = [...extra, { alias: clean, key: key(clean) }]
        return extra
      },
      async removeAlias(aliasKey: string): Promise<void> {
        extra = extra.filter((a) => a.key !== aliasKey)
      },
    },
  }
}
