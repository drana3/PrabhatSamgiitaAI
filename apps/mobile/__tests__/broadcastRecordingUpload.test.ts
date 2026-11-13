import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {}, multiRemove: async () => {}, getAllKeys: async () => [] },
}))

import { publishRecording, type RemoteConfig, type RemoteRecording } from "@/lib/kirtan/remote"
import { buildSubmission } from "@/lib/kirtan/submissions"

/** A recording file uploaded for an ended broadcast carries the broadcast's id the whole way (docs/broadcasts.md, "Recordings"). */

describe("a recording made from a broadcast", () => {
  const rec = { id: "r1", kind: "kiirtan", type: "other", title: "T", author: "A", added_by: "A", author_id: null, by_author: false, status: "pending", duration_sec: null, plays: 0, audio_url: "u", thumbnail_url: null, published_at: null, created_at: "2026-01-01T00:00:00Z" } as unknown as RemoteRecording
  const common = { key: "k", kind: "bhajan" as const, type: "other", title: "T", author: "A", byAuthor: false, termsVersion: "v", confirmDifferent: false }

  const world = () => {
    const bodies: Record<string, unknown>[] = []
    const fake = (async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)))
      return new Response(JSON.stringify(rec), { status: 200, headers: { "content-type": "application/json" } })
    }) as unknown as typeof fetch
    const cfg: RemoteConfig = { baseUrl: "https://api.test/", headers: () => ({}), fetch: fake }
    return { bodies, cfg }
  }

  it("sends broadcast_id when there is one, and nothing otherwise", async () => {
    const { bodies, cfg } = world()
    await publishRecording(cfg, { ...common, broadcastId: "b-123" })
    await publishRecording(cfg, { ...common, broadcastId: null })
    await publishRecording(cfg, { ...common })
    expect(bodies[0]).toMatchObject({ broadcast_id: "b-123" })
    expect(bodies[1]).not.toHaveProperty("broadcast_id")
    expect(bodies[2]).not.toHaveProperty("broadcast_id")
  })

  it("keeps the broadcast on the submission of the queue", () => {
    const input = { kind: "bhajan" as const, fileName: "talk.mp3", fileUri: "blob:x", title: "T", author: "A", byAuthor: false, addedBy: "You", termsAccepted: true }
    expect(buildSubmission({ ...input, broadcastId: "b-123" }, 1)).toMatchObject({ broadcastId: "b-123" })
    expect(buildSubmission(input, 1)).not.toHaveProperty("broadcastId")
    expect(buildSubmission({ ...input, broadcastId: null }, 1)).not.toHaveProperty("broadcastId")
  })
})
