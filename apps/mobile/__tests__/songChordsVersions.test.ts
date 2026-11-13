import { describe, expect, it } from "vitest"

import { createMockBackend, MockFailure } from "@/lib/songChords/mock"
import { chordNotices, EMPTY_SEEN, type ChordNoticeKey } from "@/lib/songChords/notices"
import { payloadToWire, proposalFromWire, type WireProposal } from "@/lib/songChords/remote"
import type { ChordProposal, ProposalPayload } from "@/lib/songChords/types"

const say = (key: ChordNoticeKey, params: Record<string, string | number>) => `${key}|${Object.values(params).join(",")}`
const names = { guitar: "Guitar", harmonium: "Harmonium" }

const PAYLOAD: ProposalPayload = {
  songId: 3,
  instrument: "harmonium",
  baseKey: "C",
  capo: 0,
  strum: null,
  lines: [{ placements: [{ word: 0, chord: "G" }, { word: 2, chord: "Am" }] }],
  playedIt: true,
  note: null,
  isAnonymous: false,
}

describe("a new version replaces the live chart (preview backend, same rules as the server)", () => {
  it("while it waits the old chart stays live; once accepted the old one is archived, not deleted", async () => {
    const api = createMockBackend({ me: () => "Me", seedMine: true, team: () => false })
    const newer = await api.offer({ ...PAYLOAD, baseKey: "D", replacesId: "preview-mine-live" })
    expect(newer).toMatchObject({ status: "pending", replaces: "preview-mine-live" })
    expect((await api.listForSong(3)).map((p) => p.id)).toContain("preview-mine-live")

    // the team accepts it (the same backend, seen as the team)
    const team = createMockBackend({ me: () => "Me", seedMine: true, team: () => true })
    const made = await team.offer({ ...PAYLOAD, baseKey: "D", replacesId: "preview-mine-live" })
    expect(made.status).toBe("published")
    const mine = await team.mine()
    const old = mine.find((p) => p.id === "preview-mine-live")
    expect(old).toMatchObject({ archived: true, replacedBy: made.id, status: "published" })
    expect((await team.listForSong(3)).map((p) => p.id)).toEqual([made.id])
  })
  it("only the author's own live chart of the same song can be replaced; the cap leaves room for the replacement", async () => {
    const api = createMockBackend({ me: () => "Me", seedMine: true, team: () => true })
    const stranger = await api.offer({ ...PAYLOAD, songId: 1, instrument: "guitar", baseKey: "E", replacesId: "preview-sample-1" })
    expect(stranger.replaces).toBeNull()
    expect((await api.listForSong(1)).map((p) => p.id)).toContain("preview-sample-1")
  })
  it("deleting a chart cuts the links to it", async () => {
    const api = createMockBackend({ me: () => "Me", seedMine: true, team: () => true })
    const newer = await api.offer({ ...PAYLOAD, baseKey: "D", replacesId: "preview-mine-live" })
    await api.remove("preview-mine-live")
    expect((await api.mine()).find((p) => p.id === newer.id)?.replaces).toBeNull()
  })
})

describe("the credit of a chart started from another", () => {
  it("names the author, links to the original, and says nothing about an anonymous one", async () => {
    const api = createMockBackend({ me: () => "Me", seedMine: false })
    const named = await api.offer({ ...PAYLOAD, songId: 1, instrument: "guitar", baseKey: "C", basedOnId: "preview-sample-1" })
    expect(named.basedOn).toEqual({ id: "preview-sample-1", name: "Preview member" })
    const anonymous = await api.offer({ ...PAYLOAD, songId: 1, instrument: "harmonium", baseKey: "D", basedOnId: "preview-sample-2" })
    expect(anonymous.basedOn).toEqual({ id: "preview-sample-2", name: null })
    expect(JSON.stringify(anonymous)).not.toContain("Preview member")
  })
  it("is dropped when the original is not another member's published chart of that song", async () => {
    const api = createMockBackend({ me: () => "Me", seedMine: true })
    const wrongSong = await api.offer({ ...PAYLOAD, songId: 4, baseKey: "E", basedOnId: "preview-sample-1" })
    expect(wrongSong.basedOn).toBeNull()
    const own = await api.offer({ ...PAYLOAD, songId: 3, baseKey: "F", basedOnId: "preview-mine-live" })
    expect(own.basedOn).toBeNull()
  })
})

describe("taking back a waiting chart in the preview backend", () => {
  it("removes it from the server side; a second try says it is gone", async () => {
    const api = createMockBackend({ me: () => "Me", seedMine: true })
    await api.remove("preview-mine-pending")
    expect((await api.mine()).some((p) => p.id === "preview-mine-pending")).toBe(false)
    await expect(api.remove("preview-mine-pending")).rejects.toBeInstanceOf(MockFailure)
  })
})

describe("the wire", () => {
  const WIRE: WireProposal = {
    id: "c1",
    song_id: 19,
    instrument: "guitar",
    base_key: "A",
    capo: 2,
    strum: null,
    lines: [{ placements: [{ word: 0, chord: "A" }] }],
    note: null,
    played_it: true,
    created_at: "2026-11-01T10:00:00Z",
    is_anonymous: false,
    author: { name: "Ananda" },
    mine: true,
    status: "published",
    rejected_reason: null,
    can_review: false,
  }
  it("reads the credit, the archive state and the replacement from the server's answer", () => {
    const p = proposalFromWire({ ...WIRE, based_on: { id: "o", name: null }, archived: true, replaced_by: "n", replaces: null })
    expect(p).toMatchObject({ basedOn: { id: "o", name: null }, archived: true, replacedBy: "n", replaces: null })
    expect(proposalFromWire(WIRE)).toMatchObject({ basedOn: null, archived: false, replacedBy: null, replaces: null })
  })
  it("sends the replaced chart and the credit only when there are ones", () => {
    const plain = payloadToWire(PAYLOAD)
    expect("replaces_id" in plain || "based_on_id" in plain).toBe(false)
    expect(payloadToWire({ ...PAYLOAD, replacesId: "a", basedOnId: "b" })).toMatchObject({ replaces_id: "a", based_on_id: "b" })
  })
})

describe("the notice that an old version was replaced", () => {
  const chart = (over: Partial<ChordProposal>): ChordProposal => ({
    id: "old",
    songId: 3,
    instrument: "harmonium",
    baseKey: "C",
    capo: 0,
    strum: null,
    lines: [],
    note: null,
    playedIt: true,
    createdAt: "2026-11-01T00:00:00Z",
    isAnonymous: false,
    author: null,
    mine: true,
    status: "published",
    rejectedReason: null,
    canReview: false,
    ...over,
  })
  it("fires once, when the chart turns archived, and opens the song", () => {
    const seen = { statuses: { old: { status: "published" as const, n: 0 } } }
    const first = chordNotices(seen, [chart({ archived: true, replacedBy: "new" })], 7, say, names)
    expect(first.notices).toHaveLength(1)
    expect(first.notices[0]).toMatchObject({ id: "chords:old:replaced", target: "/song-v2/ps-3", firedAt: 7 })
    expect(first.notices[0].title).toContain("notif.chords.replaced.title")
    const again = chordNotices(first.seen, [chart({ archived: true, replacedBy: "new" })], 8, say, names)
    expect(again.notices).toEqual([])
  })
  it("a chart first seen already archived (a new install) says nothing", () => {
    expect(chordNotices(EMPTY_SEEN, [chart({ archived: true })], 1, say, names).notices).toEqual([])
  })
})
