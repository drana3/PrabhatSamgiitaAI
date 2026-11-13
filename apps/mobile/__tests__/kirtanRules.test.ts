import { describe, expect, it } from "vitest"

import { authorBlockKey, mergeCatalog, withoutBlocked } from "@/lib/kirtan/list"
import { clearStoredUploads, KIRTAN_STORE_VERSION, migrateKirtanState, migrateKirtanStore, normalizeStatus } from "@/lib/kirtan/migrate"
import { audioContentType, isRulesAccepted, MAX_UPLOAD_BYTES, REPORT_REASONS, RULES_VERSION, ruleSections, validateAudioFile } from "@/lib/kirtan/rules"
import type { Kirtan } from "@/lib/kirtan/types"

function kirtan(over: Partial<Kirtan>): Kirtan {
  return { id: "k", kind: "kiirtan", title: "T", author: "A", durationSec: null, type: "other", byAuthor: false, audioUrl: "u", thumbnailUrl: null, addedBy: "x", status: "published", addedAt: 1, ...over }
}

describe("file checks", () => {
  it("accepts audio by extension or type and refuses the rest", () => {
    expect(audioContentType("a.mp3")).toBeTruthy()
    expect(audioContentType("a.pdf")).toBeNull()
    expect(validateAudioFile({ name: "a.mp3", size: 1000 })).toBeNull()
    expect(validateAudioFile({ name: "a.exe", size: 1000 })).toBe("format")
    expect(validateAudioFile({ name: "a.mp3", size: MAX_UPLOAD_BYTES + 1 })).toBe("size")
    expect(validateAudioFile({ name: "a.mp3", size: null })).toBeNull()
  })
})

describe("content rules", () => {
  it("has sections and the five report reasons, Duplicate among them", () => {
    expect(ruleSections().length).toBeGreaterThanOrEqual(4)
    expect(ruleSections().every((s) => s.title && s.body)).toBe(true)
    expect([...REPORT_REASONS]).toEqual(["copyright", "offensive", "wrong_info", "duplicate", "other"])
  })

  it("agreement counts only for today's version with a real date", () => {
    expect(isRulesAccepted(null)).toBe(false)
    expect(isRulesAccepted({ acceptedAt: null, version: null })).toBe(false)
    expect(isRulesAccepted({ acceptedAt: "junk", version: RULES_VERSION })).toBe(false)
    expect(isRulesAccepted({ acceptedAt: "2026-11-01T00:00:00Z", version: "2020-01" })).toBe(false)
    expect(isRulesAccepted({ acceptedAt: "2026-11-01T00:00:00Z", version: RULES_VERSION })).toBe(true)
  })
})

describe("blocking authors", () => {
  it("blocks by account id; by name only in the demo", () => {
    expect(authorBlockKey(kirtan({ authorId: "m1" }))).toBe("m1")
    expect(authorBlockKey(kirtan({ author: " Group " }))).toBeNull()
    expect(authorBlockKey(kirtan({ author: " Group " }), true)).toBe("name:group")
  })

  it("hides recordings of a blocked author, by id or by demo name", () => {
    const list = [kirtan({ id: "a", authorId: "m1" }), kirtan({ id: "b", authorId: "m2" }), kirtan({ id: "c", author: "Demo Group" }), kirtan({ id: "d", author: "Other" })]
    expect(withoutBlocked(list, []).map((k) => k.id)).toEqual(["a", "b", "c", "d"])
    expect(withoutBlocked(list, ["m1", "name:demo group"]).map((k) => k.id)).toEqual(["b", "d"])
  })

  it("mergeCatalog puts own uploads first, drops copies of own and blocked authors", () => {
    const own = [kirtan({ id: "own", serverId: "s1", authorId: "me" })]
    const remote = [kirtan({ id: "srv-s1", serverId: "s1", authorId: "me" }), kirtan({ id: "srv-s2", serverId: "s2", authorId: "m1" }), kirtan({ id: "srv-s3", serverId: "s3", authorId: "m2" })]
    const sample = [kirtan({ id: "demo", author: "Demo" })]
    expect(mergeCatalog(own, remote, sample, ["m1"]).map((k) => k.id)).toEqual(["own", "srv-s3", "demo"])
    expect(mergeCatalog(own, remote, sample, ["me"]).map((k) => k.id)).toEqual(["own", "srv-s2", "srv-s3", "demo"])
  })
})

describe("migration to publish-first", () => {
  it("is version 4 and maps the old statuses", () => {
    expect(KIRTAN_STORE_VERSION).toBe(6)
    expect(normalizeStatus("approved")).toBe("published")
    expect(normalizeStatus("pending")).toBe("failed")
    expect(normalizeStatus("rejected")).toBe("removed")
    expect(normalizeStatus("uploading")).toBe("uploading")
    expect(normalizeStatus("nonsense")).toBe("failed")
  })

  it("lets an old pending upload be sent again and starts with no blocks", () => {
    const out = migrateKirtanState({ submissions: [{ id: "x", title: "T", author: "A", type: "other", status: "pending" }], savedIds: ["s"] }, 2)
    expect(out.submissions[0]).toMatchObject({ status: "failed", failure: { code: "server" } })
    expect(out.blockedAuthorIds).toEqual([])
    expect(out.blockedNames).toEqual({})
    expect(out.savedIds).toEqual(["s"])
  })

  it("keeps blocks that are already stored", () => {
    const out = migrateKirtanState({ blockedAuthorIds: ["m1", 5], blockedNames: { m1: "Group", m2: 7 } }, 3)
    expect(out.blockedAuthorIds).toEqual(["m1"])
    expect(out.blockedNames).toEqual({ m1: "Group" })
  })
})

describe("the clean start of version 5", () => {
  const old = { submissions: [{ id: "x", title: "T", author: "A", type: "other", status: "published" }], savedIds: ["s"], reportedIds: ["r"], blockedAuthorIds: ["b"], blockedNames: { b: "B" } }

  it("drops the stored uploads of an older version and keeps saved, reported and blocked", () => {
    const out = migrateKirtanStore(old, 4)
    expect(out.submissions).toEqual([])
    expect(out).toMatchObject({ savedIds: ["s"], reportedIds: ["r"], blockedAuthorIds: ["b"], blockedNames: { b: "B" } })
  })

  it("keeps the uploads of the current version", () => {
    expect(migrateKirtanStore(old, 5).submissions).toHaveLength(1)
  })

  it("clears the uploads kept for the accounts that are not in use", () => {
    const slots = { a: { submissions: [{ id: "x" }], savedIds: ["s"] }, b: null }
    expect(clearStoredUploads(slots)).toEqual({ a: { submissions: [], savedIds: ["s"] }, b: null })
  })
})
