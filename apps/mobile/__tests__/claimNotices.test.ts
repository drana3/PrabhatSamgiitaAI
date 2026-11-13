import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {}, multiRemove: async () => {}, getAllKeys: async () => [] },
}))

import { claimItem, claimItems, syncClaimNotices } from "@/lib/authors/claimNotices"
import { pagesOf } from "@/lib/authors/onPages"
import type { RemoteNotice } from "@/lib/kirtan/remote"
import { channelOf, kindMeta } from "@/lib/notifications/kinds"
import { isExpired } from "@/lib/notifications/retention"
import { resolveTarget } from "@/lib/notifications/target"

const notice = (id: string, kind: string, payload: Record<string, unknown>, extra: Partial<RemoteNotice> = {}): RemoteNotice => ({
  id,
  kind,
  recording_id: null,
  title: "x",
  body: "x",
  payload,
  created_at: "2026-11-08T09:00:00Z",
  read_at: null,
  ...extra,
})

describe("author claim notices in the notification centre", () => {
  it("tells the page owner a claim was approved and opens the page", () => {
    const item = claimItem(notice("n1", "claim_approved", { profile_slug: "priya-devi", count: 3, note: "" }))
    expect(item).toMatchObject({ id: "claim:n1", kind: "claim", target: "/author/priya-devi" })
    expect(item?.title).toBe("Claim approved")
    expect(item?.text).toBe("Your claim was approved: 3 on your author page.")
  })

  it("adds the team's note and sends a declined request to the list of requests", () => {
    const item = claimItem(notice("n2", "claim_rejected", { profile_slug: "priya-devi", count: 1, note: "Not her voice" }))
    expect(item).toMatchObject({ id: "claim:n2", kind: "claim", target: "/author-claims" })
    expect(item?.text).toBe("Your claim was declined: 1. Team note: Not her voice")
  })

  it("tells the page owner a recording was taken off", () => {
    const item = claimItem(notice("n3", "claim_revoked", { profile_slug: "priya-devi", count: 2 }))
    expect(item?.text).toBe("A recording was taken off your author page: 2.")
    expect(item?.target).toBe("/author/priya-devi")
  })

  it("tells the uploader that the recording is on an author page, and links the page", () => {
    const item = claimItem(notice("n4", "claim_on_your_recording", { profile_slug: "ravi-kiirtan", page_name: "Ravi Kiirtan", recording_title: "Lila kiirtan 1" }))
    expect(item).toMatchObject({ id: "onpage:n4", kind: "onpage", target: "/author/ravi-kiirtan" })
    expect(item?.text).toBe("Your recording “Lila kiirtan 1” is now on the author page of Ravi Kiirtan.")
  })

  it("never puts a strange slug into a route, and skips what is malformed or of another kind", () => {
    expect(claimItem(notice("a", "claim_approved", { profile_slug: "../../etc", count: 1 }))?.target).toBe("/author-claims")
    expect(claimItem(notice("b", "claim_on_your_recording", { profile_slug: "x y", page_name: "X", recording_title: "T" }))).toBeNull()
    expect(claimItem(notice("c", "claim_on_your_recording", { profile_slug: "x", page_name: "X" }))).toBeNull()
    expect(claimItem(notice("d", "claim_approved", { profile_slug: "x" }, { created_at: "nonsense" }))).toBeNull()
    expect(claimItems([notice("e", "comment_reply", { parent_id: "c-1" }), notice("f", "claim_approved", { profile_slug: "x", count: 1 })]).map((i) => i.id)).toEqual(["claim:f"])
  })

  it("is account-bound, on the notices channel, kept 90 and 30 days, and the target exists", () => {
    expect(kindMeta("claim")).toMatchObject({ tier: "reminder", accountBound: true, keepDays: 90 })
    expect(kindMeta("onpage")).toMatchObject({ tier: "reminder", accountBound: true, keepDays: 30, ios: "passive" })
    expect(channelOf("claim")).toBe("notices")
    const fired = Date.parse("2026-11-08T09:00:00Z")
    expect(isExpired({ id: "claim:x", kind: "claim", firedAt: fired }, [], fired + 89 * 86_400_000)).toBe(false)
    expect(isExpired({ id: "claim:x", kind: "claim", firedAt: fired }, [], fired + 90 * 86_400_000)).toBe(true)
    expect(resolveTarget({ kind: "claim", target: "/author/priya-devi" }).missing).toBe(false)
    expect(resolveTarget({ kind: "claim", target: null })).toMatchObject({ missing: true, route: "/author-claims" })
  })
})

describe("asking the server for the claim notices", () => {
  beforeEach(async () => {
    const { useNotificationsStore } = await import("@/stores/notificationsStore")
    useNotificationsStore.getState().reset()
  })

  it("puts the claim notices in the centre, marks only those read, and leaves the replies alone", async () => {
    const calls: string[] = []
    const recent = { created_at: new Date(Date.now() - 3_600_000).toISOString() }
    const list = [
      notice("n1", "claim_approved", { profile_slug: "priya-devi", count: 2 }, recent),
      notice("n2", "claim_on_your_recording", { profile_slug: "ravi-kiirtan", page_name: "Ravi Kiirtan", recording_title: "Lila" }, recent),
      notice("n3", "comment_reply", { parent_id: "c-1" }, recent),
    ]
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url.replace("http://api.test", "")}`)
      return new Response(JSON.stringify((init?.method ?? "GET") === "GET" ? list : list[0]), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    const cfg = { baseUrl: "http://api.test", headers: () => ({}), fetch: fetch as unknown as typeof globalThis.fetch }
    expect(await syncClaimNotices(cfg)).toBe(2)
    expect(calls).toEqual(["GET /api/v1/recordings/notices?unread_only=true", "POST /api/v1/recordings/notices/n1/read", "POST /api/v1/recordings/notices/n2/read"])
    const { useNotificationsStore } = await import("@/stores/notificationsStore")
    expect(useNotificationsStore.getState().items.map((i) => i.id).sort()).toEqual(["claim:n1", "onpage:n2"])
  })

  it("never throws when the server is out of reach", async () => {
    const cfg = { baseUrl: "http://api.test", headers: () => ({}), fetch: (async () => { throw new Error("offline") }) as unknown as typeof globalThis.fetch }
    await expect(syncClaimNotices(cfg)).resolves.toBe(0)
  })
})

describe("the author pages that show my recordings", () => {
  it("picks the pages of one recording and none for an unknown one", () => {
    const items = [{ recording_id: "r1", pages: [{ id: "p1", slug: "priya-devi", name: "Priya Devi" }] }]
    expect(pagesOf(items, "r1")).toHaveLength(1)
    expect(pagesOf(items, "r2")).toEqual([])
    expect(pagesOf(items, undefined)).toEqual([])
  })
})
