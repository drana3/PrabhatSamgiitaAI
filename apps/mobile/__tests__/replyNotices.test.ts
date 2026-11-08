import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {}, multiRemove: async () => {}, getAllKeys: async () => [] },
}))

import { replyItems, syncReplyNotices } from "@/lib/comments/replyNotices"
import type { RemoteNotice } from "@/lib/kirtan/remote"
import { rowsOf } from "@/lib/notifications/grouping"
import { KIND_META, channelOf, kindMeta } from "@/lib/notifications/kinds"
import { isExpired, isUnread } from "@/lib/notifications/retention"
import { replyNotification, replyTarget } from "@/lib/notifications/serverKinds"
import { resolveTarget } from "@/lib/notifications/target"
import { songCommentsEn, songCommentsEs, songCommentsRu } from "@/locales/songComments"

const NOW = Date.parse("2026-11-07T10:00:00Z")
const notice = (id: string, payload: Record<string, unknown>, extra: Partial<RemoteNotice> = {}): RemoteNotice => ({
  id,
  kind: "comment_reply",
  recording_id: null,
  title: "New reply",
  body: "x",
  payload,
  created_at: "2026-11-07T09:00:00Z",
  read_at: null,
  ...extra,
})

describe("the notice to the author of a comment", () => {
  it("names the replier, opens the song page with the thread, and folds by the comment", () => {
    const [item] = replyItems([notice("n1", { song_id: 19, parent_id: "c-1", from_name: "Bhakti" })])
    expect(item).toMatchObject({ id: "reply:n1", kind: "reply", target: "/song-v2/ps-19?comment=c-1", group: "c-1" })
    expect(item?.text).toBe("Bhakti replied to your comment.")
    expect(item?.firedAt).toBe(Date.parse("2026-11-07T09:00:00Z"))
  })

  it("says Someone for an anonymous reply and carries no name", () => {
    const [item] = replyItems([notice("n2", { song_id: 19, parent_id: "c-1", from_name: null })])
    expect(item?.text).toBe(songCommentsEn["songComments.notice.textAnonymous"])
    expect(JSON.stringify(item)).not.toMatch(/Bhakti/)
  })

  it("opens the recording page for a reply under a recording", () => {
    const [item] = replyItems([notice("n3", { recording_id: "rec-9", parent_id: "c-2", from_name: "Karuna" }, { recording_id: "rec-9" })])
    expect(item?.target).toBe("/recording/rec-9?comment=c-2")
  })

  it("leaves other kinds alone and skips what is malformed", () => {
    const items = replyItems([
      notice("a", { song_id: 19, parent_id: "c-1" }, { kind: "recording_removed" }),
      notice("b", { song_id: 19 }), // no thread
      notice("c", { parent_id: "c-1" }), // no song and no recording
      notice("d", { song_id: 19, parent_id: "../../etc" }), // not an id
      notice("e", { song_id: 19, parent_id: "c-1" }, { created_at: "not a date" }),
      notice("f", { song_id: 0, parent_id: "c-1" }),
    ])
    expect(items).toEqual([])
    expect(replyTarget({ songNumber: 5, parentId: "ok-1" })).toBe("/song-v2/ps-5?comment=ok-1")
    expect(replyNotification({ noticeId: "z", from: null, parentId: "c-1", firedAt: NOW })).toBeNull()
  })

  it("folds three replies to one comment into one row, and not replies to different comments", () => {
    const mk = (id: string, parent: string, ago: number) => replyNotification({ noticeId: id, from: "A", songNumber: 3, parentId: parent, firedAt: NOW - ago * 60_000 })!
    const three = [mk("1", "c-1", 5), mk("2", "c-1", 10), mk("3", "c-1", 15)]
    const rows = rowsOf(three)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: "group", kind: "reply" })
    expect(rowsOf([mk("1", "c-1", 5), mk("2", "c-1", 10)])).toHaveLength(2)
    // two replies to one comment and two to another: four single rows, never one mixed group of four
    expect(rowsOf([mk("1", "c-1", 5), mk("2", "c-1", 10), mk("3", "c-2", 15), mk("4", "c-2", 20)])).toHaveLength(4)
    expect(rowsOf([mk("1", "c-1", 5), mk("2", "c-1", 10), mk("3", "c-1", 15), mk("4", "c-2", 20)]).map((r) => r.type)).toEqual(["group", "item"])
  })

  it("is a reminder-tier, account-bound, groupable kind on its own channel, kept 30 days", () => {
    expect(kindMeta("reply")).toMatchObject({ tier: "reminder", source: "server", accountBound: true, groupable: true, channel: "replies", keepDays: 30, groupCount: "replies" })
    expect(channelOf("reply")).toBe("replies")
    expect(KIND_META.reply.fallback.startsWith("/")).toBe(true)
    const item = { id: "reply:x", kind: "reply", firedAt: NOW }
    expect(isExpired(item, [], NOW + 29 * 86_400_000)).toBe(false)
    expect(isExpired(item, [], NOW + 30 * 86_400_000)).toBe(true)
    // a reply stays unread-counted for the same week as a reminder, then stops nagging
    expect(isUnread(item, [], NOW + 86_400_000)).toBe(true)
    expect(isUnread(item, [], NOW + 8 * 86_400_000)).toBe(false)
  })

  it("points at a place that exists; a gone song falls back to the song list", () => {
    const [item] = replyItems([notice("n1", { song_id: 19, parent_id: "c-1" })])
    expect(resolveTarget(item!, { songNumbers: new Set([19]) })).toEqual({ missing: false, route: "/song-v2/ps-19?comment=c-1" })
    expect(resolveTarget(item!, { songNumbers: new Set([1, 2]) })).toMatchObject({ missing: true, route: "/v2/songs" })
  })

  it("has its words in every language", () => {
    for (const words of [songCommentsEn, songCommentsRu, songCommentsEs] as Record<string, string>[]) {
      for (const key of ["title", "text", "textAnonymous", "group_one", "group_other"]) expect(words[`songComments.notice.${key}`]).toBeTruthy()
      expect(words["songComments.notice.text"]).toContain("{name}")
    }
    expect((songCommentsRu as Record<string, string>)["songComments.notice.group_few"]).toBeTruthy()
  })
})

describe("asking the server for the notices", () => {
  beforeEach(async () => {
    const { useNotificationsStore } = await import("@/stores/notificationsStore")
    useNotificationsStore.getState().reset()
  })

  it("puts the replies in the centre and marks every reply notice read, once", async () => {
    const calls: string[] = []
    const list = [
      notice("n1", { song_id: 19, parent_id: "c-1", from_name: "Bhakti" }),
      notice("n2", { song_id: 19, parent_id: "c-1", from_name: null }),
      notice("n3", { song_id: 19, parent_id: "c-1" }, { kind: "recording_removed" }),
    ]
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url.replace("http://api.test", "")}`)
      if ((init?.method ?? "GET") === "GET") return new Response(JSON.stringify(list), { status: 200, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify(list[0]), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    const cfg = { baseUrl: "http://api.test", headers: () => ({}), fetch: fetch as unknown as typeof globalThis.fetch }
    const count = await syncReplyNotices(cfg)
    expect(count).toBe(2)
    expect(calls).toEqual([
      "GET /api/v1/recordings/notices?unread_only=true",
      "POST /api/v1/recordings/notices/n1/read",
      "POST /api/v1/recordings/notices/n2/read",
    ])
    const { useNotificationsStore } = await import("@/stores/notificationsStore")
    expect(useNotificationsStore.getState().items.map((i) => i.id).sort()).toEqual(["reply:n1", "reply:n2"])
    // the same notices coming again change nothing
    await syncReplyNotices(cfg)
    expect(useNotificationsStore.getState().items).toHaveLength(2)
  })

  it("never throws when the server is out of reach", async () => {
    const cfg = { baseUrl: "http://api.test", headers: () => ({}), fetch: (async () => { throw new Error("offline") }) as unknown as typeof globalThis.fetch }
    await expect(syncReplyNotices(cfg)).resolves.toBe(0)
  })
})
