import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => {
  const memory = new Map<string, string>()
  return {
    default: {
      getItem: async (key: string) => memory.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: async (key: string) => {
        memory.delete(key)
      },
    },
  }
})
vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: { webBaseUrl: "https://example.test" } } } }))

const cancelSimilar = vi.fn(async () => undefined)
vi.mock("@/lib/kirtan/uploadRunner", () => ({ runUpload: vi.fn(), cancelSimilar: (...args: unknown[]) => cancelSimilar(...(args as [])) }))

import { NetworkError, RemoteError } from "@/lib/kirtan/remote"
import type { SetPorts, TrackOutcome } from "@/lib/kirtan/setPorts"
import { newSetId, setSetPorts, stateOfDraft, useUploadSetStore } from "@/stores/uploadSetStore"

const store = () => useUploadSetStore.getState()
const pick = (id: string, ...names: string[]) => store().addFiles(id, names.map((name) => ({ name, uri: `file:///${name}`, size: 1000, type: "audio/mpeg" })))
const draft = (id: string) => store().drafts.find((d) => d.id === id)!
const statuses = (id: string) => draft(id).tracks.map((t) => t.status)

type Script = { create?: () => Promise<void>; tracks: Array<TrackOutcome | Error> }

function fake(script: Script) {
  const calls = { create: 0, sent: [] as Array<{ name: string; position: number }>, reorder: [] as string[][], finish: 0 }
  const ports: SetPorts = {
    online: () => true,
    create: async () => {
      calls.create += 1
      await script.create?.()
    },
    uploadTrack: async (_draft, track, position) => {
      calls.sent.push({ name: track.fileName, position })
      const answer = script.tracks.shift() ?? { status: "published" as const, recordingId: `rec-${track.fileName}` }
      if (answer instanceof Error) throw answer
      return answer
    },
    reorder: async (_draft, ids) => {
      calls.reorder.push([...ids])
    },
    putCover: async () => {},
    finish: async () => {
      calls.finish += 1
    },
  }
  return { ports, calls }
}

function ready(...names: string[]) {
  const id = store().begin()
  store().details(id, { title: "Dhanbad retreat", eventYear: 2026, performer: "Priya Devi", defaultStyle: "bengali", defaultRecordingType: "studio", confirmed: true })
  pick(id, ...names)
  return id
}

beforeEach(() => {
  setSetPorts(null)
  cancelSimilar.mockClear()
  useUploadSetStore.setState({ drafts: [], archive: [], running: null, stopped: null, error: null })
})

describe("making a set", () => {
  it("makes a v4-shaped id on the phone", () => {
    expect(newSetId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(newSetId()).not.toBe(newSetId())
  })

  it("begin with a known id returns the same draft (continue after the app was closed)", () => {
    const id = store().begin("aaaaaaaa-0000-4000-8000-000000000000")
    expect(store().begin(id)).toBe(id)
    expect(store().drafts).toHaveLength(1)
  })

  it("editing the details never touches the tracks; the order buttons and sort work", () => {
    const id = ready("2 b.mp3", "10 c.mp3", "1 a.mp3")
    const before = draft(id).tracks
    store().details(id, { place: "Ranchi" })
    expect(draft(id).tracks).toEqual(before)
    store().sortByName(id)
    expect(draft(id).tracks.map((t) => t.fileName)).toEqual(["1 a.mp3", "2 b.mp3", "10 c.mp3"])
    store().nudge(id, draft(id).tracks[2]!.id, -1)
    expect(draft(id).tracks.map((t) => t.fileName)).toEqual(["1 a.mp3", "10 c.mp3", "2 b.mp3"])
  })

  it("tells how many files were left out", () => {
    const id = ready("a.mp3")
    expect(pick(id, "a.mp3", "b.mp3")).toEqual({ added: 1, skipped: 1, overLimit: 0 })
  })

  it("discard removes the draft and cancels the parked similar-file question", async () => {
    const id = ready("a.mp3")
    const track = draft(id).tracks[0]!
    useUploadSetStore.setState({ drafts: [{ ...draft(id), tracks: [{ ...track, status: "similar", similar: { submissionId: "s", key: "k9", briefs: [] } }] }] })
    await store().discard(id)
    expect(store().drafts).toEqual([])
    expect(cancelSimilar).toHaveBeenCalledWith("k9")
  })
})

describe("cover picture", () => {
  it("waits for the playlist to exist, goes up once, and a failure never stops the tracks", async () => {
    const { ports, calls } = fake({ tracks: [] })
    const sent: string[] = []
    ports.putCover = async (d) => {
      sent.push(d.coverUri)
    }
    setSetPorts(ports)
    const id = ready("a.mp3")
    store().cover(id, "file:///cover.jpg")
    expect(draft(id)).toMatchObject({ coverUri: "file:///cover.jpg", coverState: "pending" })
    await store().upload(id)
    expect(sent).toEqual(["file:///cover.jpg"])
    expect(draft(id).coverState).toBe("sent")
    expect(statuses(id)).toEqual(["done"])
    expect(calls.finish).toBe(1)
  })

  it("a failed cover leaves the set whole and says failed", async () => {
    const { ports } = fake({ tracks: [] })
    ports.putCover = async () => {
      throw new Error("offline")
    }
    setSetPorts(ports)
    const id = ready("a.mp3")
    store().cover(id, "file:///cover.jpg")
    await store().upload(id)
    expect(draft(id).coverState).toBe("failed")
    expect(statuses(id)).toEqual(["done"])
  })

  it("taking the picture away clears it", () => {
    const id = ready("a.mp3")
    store().cover(id, "file:///cover.jpg")
    store().cover(id, "")
    expect(draft(id)).toMatchObject({ coverUri: "", coverState: "none" })
  })
})

describe("uploading", () => {
  it("says why it did not start: details, rules, nothing to send, a missing field", async () => {
    const { ports, calls } = fake({ tracks: [] })
    setSetPorts(ports)
    const id = store().begin()
    expect(await store().upload(id)).toBe("details")
    store().details(id, { title: "T", eventYear: 2026, performer: "P", defaultStyle: "bengali", defaultRecordingType: "studio" })
    expect(await store().upload(id)).toBe("rules")
    store().confirm(id, true)
    expect(await store().upload(id)).toBe("nothing")
    pick(id, "a.mp3")
    store().details(id, { defaultKind: "dance_song" })
    expect(await store().upload(id)).toBe("fields")
    expect(calls.create).toBe(0)
  })

  it("creates the set once, sends the tracks in order, sends the order and finishes", async () => {
    const { ports, calls } = fake({ tracks: [] })
    setSetPorts(ports)
    const id = ready("a.mp3", "b.mp3", "c.mp3")
    store().move(id, draft(id).tracks[2]!.id, 0)
    await store().upload(id)
    expect(calls.create).toBe(1)
    expect(calls.sent.map((s) => s.name)).toEqual(["c.mp3", "a.mp3", "b.mp3"])
    expect(calls.reorder).toEqual([["rec-c.mp3", "rec-a.mp3", "rec-b.mp3"]])
    expect(calls.finish).toBe(1)
    expect(draft(id)).toMatchObject({ created: true, finished: true })
    expect(stateOfDraft(draft(id))).toBe("published")
    expect(store().running).toBeNull()
  })

  it("a failed track leaves the set unfinished; its retry sends only that track and finishes", async () => {
    const { ports, calls } = fake({ tracks: [{ status: "published", recordingId: "r1" }, { status: "failed", failure: { code: "server" } }] })
    setSetPorts(ports)
    const id = ready("a.mp3", "b.mp3", "c.mp3")
    await store().upload(id)
    expect(statuses(id)).toEqual(["done", "failed", "done"])
    expect(calls.finish).toBe(0)
    expect(stateOfDraft(draft(id))).toBe("uploading")
    await store().retry(id, draft(id).tracks[1]!.id)
    expect(calls.sent.map((s) => s.name)).toEqual(["a.mp3", "b.mp3", "c.mp3", "b.mp3"])
    expect(calls.create).toBe(1)
    expect(calls.finish).toBe(1)
    expect(statuses(id)).toEqual(["done", "done", "done"])
  })

  it("removing the last failed track finishes the set", async () => {
    const { ports, calls } = fake({ tracks: [{ status: "published", recordingId: "r1" }, { status: "failed", failure: { code: "server" } }] })
    setSetPorts(ports)
    const id = ready("a.mp3", "b.mp3")
    await store().upload(id)
    store().remove(id, draft(id).tracks[1]!.id)
    await vi.waitFor(() => expect(calls.finish).toBe(1))
    expect(stateOfDraft(draft(id))).toBe("published")
  })

  it("no connection: the run stops with 'network', nothing is failed, and continuing sends the rest", async () => {
    const { ports, calls } = fake({ tracks: [{ status: "published", recordingId: "r1" }, { status: "failed", failure: { code: "network" } }] })
    setSetPorts(ports)
    const id = ready("a.mp3", "b.mp3", "c.mp3")
    await store().upload(id)
    expect(store().stopped).toBe("network")
    expect(statuses(id)).toEqual(["done", "waiting", "waiting"])
    expect(calls.finish).toBe(0)
    await store().upload(id)
    expect(store().stopped).toBeNull()
    expect(statuses(id)).toEqual(["done", "done", "done"])
    expect(calls.create).toBe(1)
  })

  it("the create fails offline: the draft stays as it was and says so; the same id is used the next time", async () => {
    let attempts = 0
    const { ports, calls } = fake({
      tracks: [],
      create: async () => {
        attempts += 1
        if (attempts === 1) throw new NetworkError()
      },
    })
    setSetPorts(ports)
    const id = ready("a.mp3")
    await store().upload(id)
    expect(draft(id).created).toBe(false)
    expect(store().stopped).toBe("network")
    expect(statuses(id)).toEqual(["waiting"])
    await store().upload(id)
    expect(calls.create).toBe(2)
    expect(draft(id).created).toBe(true)
    expect(statuses(id)).toEqual(["done"])
  })

  it("too many playlists today: the run does not start and says 'startLimit'", async () => {
    const { ports, calls } = fake({
      tracks: [],
      create: async () => {
        throw new RemoteError(429, "limit", { code: "set_start_limit" })
      },
    })
    setSetPorts(ports)
    const id = ready("a.mp3")
    await store().upload(id)
    expect(store().stopped).toBe("startLimit")
    expect(calls.sent).toEqual([])
  })

  it("the daily limit stops the run; what did not go stays for tomorrow and the set is not finished", async () => {
    const { ports, calls } = fake({ tracks: [{ status: "published", recordingId: "r1" }, { status: "failed", failure: { code: "setDailyLimit" } }] })
    setSetPorts(ports)
    const id = ready("a.mp3", "b.mp3", "c.mp3")
    await store().upload(id)
    expect(store().stopped).toBe("dailyLimit")
    expect(statuses(id)).toEqual(["done", "limit", "waiting"])
    expect(calls.finish).toBe(0)
  })

  it("only one run at a time", async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const { ports, calls } = fake({ tracks: [], create: () => gate })
    setSetPorts(ports)
    const id = ready("a.mp3")
    const first = store().upload(id)
    expect(store().running).toBe(id)
    expect(await store().upload(id)).toBeNull()
    release()
    await first
    expect(calls.create).toBe(1)
  })

  it("a similar recording parks the track; 'it is different' sends it, 'same' takes it out", async () => {
    const { ports, calls } = fake({ tracks: [{ status: "similar", key: "k1", similar: [], submissionId: "s1" }] })
    setSetPorts(ports)
    const id = ready("a.mp3", "b.mp3")
    await store().upload(id)
    expect(statuses(id)).toEqual(["similar", "done"])
    await store().decideSimilar(id, draft(id).tracks[0]!.id, true)
    expect(statuses(id)).toEqual(["done", "done"])
    expect(calls.finish).toBe(1)
    const other = ready("c.mp3", "d.mp3")
    setSetPorts(fake({ tracks: [{ status: "similar", key: "k2", similar: [], submissionId: "s2" }] }).ports)
    await store().upload(other)
    await store().decideSimilar(other, draft(other).tracks[0]!.id, false)
    expect(draft(other).tracks.map((t) => t.fileName)).toEqual(["d.mp3"])
    expect(cancelSimilar).toHaveBeenCalledWith("k2")
  })
})

describe("language and dance of the whole set", () => {
  it("apply to all gives every track the dance, so a Dance music set can go", async () => {
    const { ports, calls } = fake({ tracks: [] })
    setSetPorts(ports)
    const id = ready("a.mp3", "b.mp3")
    store().details(id, { defaultKind: "dance_song" })
    expect(await store().upload(id)).toBe("fields")
    store().applyToAll(id, { dance: "kaoshiki" })
    expect(await store().upload(id)).toBeNull()
    expect(calls.sent).toHaveLength(2)
  })
})

describe("archive", () => {
  it("a published set moves to the archive and leaves the list of drafts", async () => {
    setSetPorts(fake({ tracks: [] }).ports)
    const id = ready("a.mp3")
    await store().upload(id)
    store().archiveDone(id)
    expect(store().drafts).toEqual([])
    expect(store().archive.map((d) => d.id)).toEqual([id])
  })
})
