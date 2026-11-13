import { RemoteError } from "@/lib/kirtan/remote"

import type { ClaimsDesk, DeskAction, DeskClaim, DeskStatus, DeskSummary } from "./desk"

/**
 * The in-memory stand-in for the team desk, used ONLY in the web preview (`EXPO_PUBLIC_MOCKUP_DATA=1`) and in tests.
 * Nothing reaches a server and nothing survives a reload. The pages and recordings are invented. It follows the API's
 * rules: approve a waiting, declined or taken-off request, decline a waiting one, take off an approved one, and put any
 * decision back to waiting.
 */
const HOUR = 3_600_000

type Draft = Pick<DeskClaim, "id" | "profile_id" | "profile_slug" | "profile_name" | "profile_verified" | "team_reason" | "matched_text" | "level"> & {
  title: string
  credit: string
  kind: string
  by: string
  plays: number
  status: DeskClaim["status"]
  hoursAgo: number
  note?: string
}

const PAGES = {
  priya: { profile_id: "p-priya", profile_slug: "priya-devi", profile_name: "Priya Devi", profile_verified: false },
  ravi: { profile_id: "p-ravi", profile_slug: "ravi-kiirtan", profile_name: "Ravi Kiirtan", profile_verified: true },
  group: { profile_id: "p-group", profile_slug: "dharmacakra", profile_name: "Dharmacakra Kiirtan", profile_verified: true },
}

function seed(now: number): DeskClaim[] {
  const drafts: Draft[] = [
    { id: "d1", ...PAGES.priya, team_reason: "unverified_page", matched_text: "Priya Devi", level: "same", title: "Baba Nam Kevalam, evening", credit: "Priya Devi", kind: "kiirtan", by: "Anna", plays: 41, status: "pending", hoursAgo: 3 },
    { id: "d2", ...PAGES.priya, team_reason: "unverified_page", matched_text: "Priya Devi", level: "same", title: "Morning bhajan", credit: "Priya Devi", kind: "bhajan", by: "Anna", plays: 12, status: "pending", hoursAgo: 3 },
    { id: "d3", ...PAGES.priya, team_reason: "alias_match", matched_text: "P. Devi", level: "alike", title: "Kaoshiki practice", credit: "P. Devi", kind: "kiirtan", by: "Library", plays: 7, status: "pending", hoursAgo: 3 },
    { id: "d4", ...PAGES.ravi, team_reason: "famous_name", matched_text: "Ravi Kiirtan", level: "same", title: "Lila kiirtan 1", credit: "Ravi Kiirtan", kind: "kiirtan", by: "Library", plays: 220, status: "pending", hoursAgo: 20 },
    { id: "d5", ...PAGES.group, team_reason: "group_credit", matched_text: "Dharmacakra", level: "same", title: "Festival night", credit: "Dharmacakra, Ravi", kind: "kiirtan", by: "Sam", plays: 64, status: "pending", hoursAgo: 40 },
    { id: "d6", ...PAGES.ravi, team_reason: "famous_name", matched_text: "Ravi Kiirtan", level: "same", title: "Lila kiirtan 2", credit: "Ravi Kiirtan", kind: "kiirtan", by: "Library", plays: 96, status: "approved", hoursAgo: 70 },
    { id: "d7", ...PAGES.priya, team_reason: "not_same_name", matched_text: "Priya", level: "alike", title: "Song of Priya", credit: "Priya D.", kind: "spiritual_song", by: "Sam", plays: 3, status: "rejected", hoursAgo: 90, note: "Not her voice" },
  ]
  return drafts.map((d) => ({
    id: d.id,
    profile_id: d.profile_id,
    profile_slug: d.profile_slug,
    profile_name: d.profile_name,
    profile_verified: d.profile_verified,
    recording: { id: `rec-${d.id}`, kind: d.kind, title: d.title, author: d.credit, added_by: d.by, library: d.by === "Library", duration_sec: 600, plays: d.plays },
    level: d.level,
    matched_text: d.matched_text,
    route: "team",
    status: d.status,
    team_reason: d.team_reason,
    created_at: new Date(now - d.hoursAgo * HOUR).toISOString(),
    decided_by: d.status === "pending" ? null : "team",
    decision_note: d.note ?? null,
  }))
}

const NEXT: Record<DeskAction, { to: DeskClaim["status"]; from: readonly DeskClaim["status"][] }> = {
  approve: { to: "approved", from: ["pending", "rejected", "revoked", "withdrawn"] },
  reject: { to: "rejected", from: ["pending"] },
  revoke: { to: "revoked", from: ["approved"] },
  reopen: { to: "pending", from: ["approved", "rejected", "revoked"] },
}

export function createDeskDemo(options: { team?: () => boolean; now?: () => number } = {}): ClaimsDesk {
  const team = options.team ?? (() => true)
  let rows = seed((options.now ?? Date.now)())
  const guard = (): void => {
    if (!team()) throw new RemoteError(403, "Team members only")
  }
  return {
    demo: true,
    async list(status: DeskStatus, reason?: string | null) {
      guard()
      const items = rows.filter((r) => r.status === status && (!reason || (r.team_reason ?? "other") === reason)).sort((a, b) => a.profile_id.localeCompare(b.profile_id) || a.created_at.localeCompare(b.created_at))
      return { items, total: items.length }
    },
    async summary(): Promise<DeskSummary> {
      guard()
      const by_reason: Record<string, number> = {}
      for (const r of rows) if (r.status === "pending") by_reason[r.team_reason ?? "other"] = (by_reason[r.team_reason ?? "other"] ?? 0) + 1
      const count = (s: DeskClaim["status"]) => rows.filter((r) => r.status === s).length
      return { pending: count("pending"), approved: count("approved"), rejected: count("rejected"), revoked: count("revoked"), by_reason }
    },
    async decide(ids, action, note) {
      guard()
      const rule = NEXT[action]
      const wanted = new Set(ids)
      let changed = 0
      rows = rows.map((r) => {
        if (!wanted.has(r.id) || !rule.from.includes(r.status)) return r
        changed++
        const reopening = action === "reopen"
        return { ...r, status: rule.to, decided_by: reopening ? null : "team", decision_note: reopening ? null : note?.trim() || null }
      })
      return changed
    },
  }
}
