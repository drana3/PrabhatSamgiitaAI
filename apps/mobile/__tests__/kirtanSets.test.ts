import { describe, expect, it } from "vitest"

import { setsEn, setsEs, setsRu } from "@/locales/recordingSets"

import {
  addTracks,
  isFutureDay,
  liveOrder,
  moveTrack,
  newSetDraft,
  nudgeTrack,
  parseDay,
  patchTrack,
  restoreDraft,
  retryAllTracks,
  retryTrack,
  roomLeft,
  runSet,
  setCounts,
  setProgress,
  setState,
  setTrackDay,
  setTrackFields,
  setTrackKind,
  SET_LIMITS,
  sortByFileName,
  startBlock,
  trackDay,
  trackFields,
  trackMissing,
  validateSetDetails,
  type SetDraft,
  type SetTrack,
} from "@/lib/kirtan/sets"
import type { PickedFile, RowOutcome } from "@/lib/kirtan/queue"
import { mergeSummaries, sortSummaries, summaryOfDraft, viewOfDraft, whenLabel, type SetSummary } from "@/lib/kirtan/setView"
import { setShareText, swapIds } from "@/lib/kirtan/setPage"

const NOW = new Date("2026-11-07T10:00:00Z")
const file = (name: string, size: number | null = 1000): PickedFile => ({ name, uri: `file:///${name}`, size, type: "audio/mpeg" })

let counter = 0
const newId = () => `t${(counter += 1)}`

function draftWith(names: string[], patch: Partial<SetDraft> = {}): SetDraft {
  const base: SetDraft = { ...newSetDraft("set-1", NOW), title: "Dhanbad retreat", eventYear: 2026, eventMonth: null, performer: "Priya Devi", confirmed: true, ...patch }
  return addTracks(base, names.map((name) => file(name)), newId, false).draft
}

describe("dates", () => {
  it("reads only real calendar days", () => {
    expect(parseDay("2026-11-07")).toBe("2026-11-07")
    expect(parseDay(" 2026-02-28 ")).toBe("2026-02-28")
    expect(parseDay("2026-02-30")).toBeNull()
    expect(parseDay("07.11.2026")).toBeNull()
    expect(parseDay("1800-01-01")).toBeNull()
    expect(parseDay(null)).toBeNull()
  })

  it("a day more than one day ahead is the future (the server allows a day of slack)", () => {
    expect(isFutureDay("2026-11-08", NOW)).toBe(false)
    expect(isFutureDay("2026-11-09", NOW)).toBe(true)
  })
})

describe("details of the set", () => {
  it("needs a title and a year; the first problem is named; the performer, place and month are optional", () => {
    const empty = newSetDraft("x", NOW)
    expect(validateSetDetails(empty, NOW)).toBe("title")
    expect(validateSetDetails({ ...empty, title: "A" }, NOW)).toBe("year")
    expect(validateSetDetails({ ...empty, title: "A", eventYear: 2026 }, NOW)).toBeNull()
    expect(validateSetDetails({ ...empty, title: "A", eventYear: 2026, eventMonth: 3, performer: "", place: "" }, NOW)).toBeNull()
  })

  it("a year or month ahead of today is the future", () => {
    const base = { ...newSetDraft("x", NOW), title: "A" }
    expect(validateSetDetails({ ...base, eventYear: 2027 }, NOW)).toBe("future")
    expect(validateSetDetails({ ...base, eventYear: 2026, eventMonth: 12 }, NOW)).toBe("future")
    expect(validateSetDetails({ ...base, eventYear: 2026, eventMonth: 11 }, NOW)).toBeNull()
    expect(validateSetDetails({ ...base, eventYear: 1850 }, NOW)).toBe("year")
  })
})

describe("tracks: add, order, edit", () => {
  it("keeps the order the files were picked in and titles them from the file names", () => {
    const draft = draftWith(["2_Lord.mp3", "1_Dawn.mp3"])
    expect(draft.tracks.map((t) => t.title)).toEqual(["2 Lord", "1 Dawn"])
  })

  it("leaves out a file already in the set, and one picked twice, and says how many", () => {
    const first = draftWith(["a.mp3"])
    const result = addTracks(first, [file("a.mp3"), file("b.mp3"), file("b.mp3")], newId, false)
    expect(result.draft.tracks).toHaveLength(2)
    expect(result).toMatchObject({ added: 1, skipped: 2, overLimit: 0 })
  })

  it("the same name with another size is another file", () => {
    const first = draftWith(["a.mp3"])
    expect(addTracks(first, [file("a.mp3", 2000)], newId, false).added).toBe(1)
  })

  it("stops at the limit of the set, and says how many were left out; the team has more room", () => {
    const names = Array.from({ length: SET_LIMITS.maxTracks + 5 }, (_, i) => `f${i}.mp3`)
    const result = addTracks({ ...newSetDraft("x", NOW) }, names.map((n) => file(n)), newId, false)
    expect(result.draft.tracks).toHaveLength(SET_LIMITS.maxTracks)
    expect(result.overLimit).toBe(5)
    expect(roomLeft(result.draft, false)).toBe(0)
    expect(roomLeft(result.draft, true)).toBe(SET_LIMITS.maxTracksTeam - SET_LIMITS.maxTracks)
  })

  it("moves a track to a place, clamped to the list; one step up and down", () => {
    const { tracks } = draftWith(["a.mp3", "b.mp3", "c.mp3"])
    const ids = (list: SetTrack[]) => list.map((t) => t.fileName)
    expect(ids(moveTrack(tracks, tracks[2]!.id, 0))).toEqual(["c.mp3", "a.mp3", "b.mp3"])
    expect(ids(moveTrack(tracks, tracks[0]!.id, 99))).toEqual(["b.mp3", "c.mp3", "a.mp3"])
    expect(ids(nudgeTrack(tracks, tracks[1]!.id, -1))).toEqual(["b.mp3", "a.mp3", "c.mp3"])
    expect(ids(nudgeTrack(tracks, tracks[0]!.id, -1))).toEqual(["a.mp3", "b.mp3", "c.mp3"])
    expect(ids(moveTrack(tracks, "nope", 0))).toEqual(["a.mp3", "b.mp3", "c.mp3"])
  })

  it("sorts by file name with numbers read as numbers", () => {
    const { tracks } = draftWith(["10 Lord.mp3", "2 Lord.mp3", "1 Lord.mp3"])
    expect(sortByFileName(tracks).map((t) => t.fileName)).toEqual(["1 Lord.mp3", "2 Lord.mp3", "10 Lord.mp3"])
  })

  it("a track's own date follows the set again when cleared or invalid", () => {
    let draft = draftWith(["a.mp3"], { eventYear: 2026, eventMonth: 11 })
    const id = draft.tracks[0]!.id
    expect(trackDay(draft.tracks[0]!, draft)).toBe("2026-11-01")
    draft = setTrackDay(draft, id, "2026-11-03")
    expect(trackDay(draft.tracks[0]!, draft)).toBe("2026-11-03")
    draft = setTrackDay(draft, id, "garbage")
    expect(trackDay(draft.tracks[0]!, draft)).toBe("2026-11-01")
  })

  it("swapIds moves one place or refuses at the ends", () => {
    expect(swapIds(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"])
    expect(swapIds(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"])
    expect(swapIds(["a", "b", "c"], 0, -1)).toBeNull()
    expect(swapIds(["a", "b", "c"], 2, 1)).toBeNull()
    expect(swapIds(["a"], 5, 1)).toBeNull()
  })
})

describe("language and dance of the tracks", () => {
  it("a Dance music set needs its dance, per track, and a track's own dance wins", () => {
    let draft = draftWith(["a.mp3", "b.mp3"], { defaultKind: "dance_song" })
    expect(draft.tracks.map((t) => trackMissing(t, draft))).toEqual([["dance"], ["dance"]])
    draft = { ...draft, defaultDance: "tandava" }
    expect(draft.tracks.map((t) => trackMissing(t, draft))).toEqual([[], []])
    draft = setTrackFields(draft, draft.tracks[1]!.id, { dance: "kaoshiki" })
    expect(trackFields(draft.tracks[0]!, draft)).toMatchObject({ dance: "tandava", language: null })
    expect(trackFields(draft.tracks[1]!, draft)).toMatchObject({ dance: "kaoshiki" })
  })

  it("a Spiritual song set needs its language; 'Other' needs its name", () => {
    let draft = draftWith(["a.mp3"], { defaultKind: "spiritual_song" })
    expect(trackMissing(draft.tracks[0]!, draft)).toEqual(["language"])
    draft = { ...draft, defaultLanguage: "other" }
    expect(trackMissing(draft.tracks[0]!, draft)).toEqual(["languageName"])
    draft = { ...draft, defaultLanguageOther: "Santali" }
    expect(trackMissing(draft.tracks[0]!, draft)).toEqual([])
    expect(trackFields(draft.tracks[0]!, draft)).toMatchObject({ language: "other", languageOther: "Santali" })
  })

  it("a Bhajan set needs its language too; Prabhat Samgiita and Dance music do not", () => {
    let draft = draftWith(["a.mp3", "b.mp3"], { defaultKind: "bhajan" })
    expect(trackMissing(draft.tracks[0]!, draft)).toEqual(["language"])
    expect(setCounts(draft).missing).toBe(2)
    draft = setTrackFields(draft, draft.tracks[0]!.id, { language: "bn" })
    expect(trackMissing(draft.tracks[0]!, draft)).toEqual([])
    expect(trackMissing(draft.tracks[1]!, draft)).toEqual(["language"])
    // the set's own language fills every track that has none
    draft = { ...draft, defaultLanguage: "hi" }
    expect(trackMissing(draft.tracks[1]!, draft)).toEqual([])
    expect(trackFields(draft.tracks[1]!, draft)).toMatchObject({ kind: "bhajan", language: "hi" })
    expect(trackFields(draft.tracks[0]!, draft)).toMatchObject({ language: "bn" })
    const ps = draftWith(["a.mp3"], { defaultKind: "prabhat_samgiita" })
    expect(trackMissing(ps.tracks[0]!, ps)).toEqual([])
    expect(startBlock(draftWith(["a.mp3"], { defaultKind: "bhajan" }), NOW)).toBe("fields")
  })

  it("a Kiirtan sends no language even if the set carries one; a track of another type follows that type's rule", () => {
    let draft = draftWith(["a.mp3", "b.mp3"], { defaultKind: "kiirtan", defaultLanguage: "bn" })
    expect(trackFields(draft.tracks[0]!, draft)).toMatchObject({ kind: "kiirtan", language: null, dance: null })
    draft = setTrackKind(draft, draft.tracks[1]!.id, "spiritual_song")
    expect(trackFields(draft.tracks[1]!, draft)).toMatchObject({ kind: "spiritual_song", language: "bn" })
    draft = setTrackKind(draft, draft.tracks[1]!.id, "dance_song")
    expect(trackMissing(draft.tracks[1]!, draft)).toEqual(["dance"])
  })
})

describe("state, numbers and the start rules", () => {
  it("draft until something was tried; published when every track is live", () => {
    let draft = draftWith(["a.mp3", "b.mp3"])
    expect(setState(draft)).toBe("draft")
    expect(setState(newSetDraft("x", NOW))).toBe("draft")
    draft = patchTrack(draft, draft.tracks[0]!.id, { status: "done" })
    expect(setState(draft)).toBe("uploading")
    draft = patchTrack(draft, draft.tracks[1]!.id, { status: "done" })
    expect(setState(draft)).toBe("published")
    draft = patchTrack(draft, draft.tracks[1]!.id, { status: "failed", failure: { code: "server" } })
    expect(setState(draft)).toBe("uploading")
  })

  it("a duplicate left out on purpose does not hold the set back", () => {
    let draft = draftWith(["a.mp3", "b.mp3"])
    draft = patchTrack(draft, draft.tracks[0]!.id, { status: "done" })
    draft = patchTrack(draft, draft.tracks[1]!.id, { status: "duplicate" })
    expect(setState(draft)).toBe("published")
    expect(setCounts(draft)).toMatchObject({ total: 2, live: 1, duplicate: 1 })
  })

  it("progress counts the settled tracks, not the ones that can never go", () => {
    let draft = draftWith(["a.mp3", "b.mp3", "c.mp3"])
    draft = patchTrack(draft, draft.tracks[0]!.id, { status: "done" })
    draft = patchTrack(draft, draft.tracks[1]!.id, { status: "failed", failure: { code: "size" } })
    expect(setProgress(draft)).toBeCloseTo(1 / 2)
  })

  it("start is blocked by details, then rules, then no tracks, then a missing field or title", () => {
    expect(startBlock({ ...draftWith(["a.mp3"]), title: "" }, NOW)).toBe("details")
    expect(startBlock({ ...draftWith(["a.mp3"]), confirmed: false }, NOW)).toBe("rules")
    expect(startBlock(draftWith([]), NOW)).toBe("nothing")
    expect(startBlock(draftWith(["a.mp3"], { defaultKind: "dance_song" }), NOW)).toBe("fields")
    const blank = draftWith(["a.mp3"])
    expect(startBlock(setTrackTitleBlank(blank), NOW)).toBe("fields")
    expect(startBlock(draftWith(["a.mp3"]), NOW)).toBeNull()
  })

  it("setCounts says how many waiting tracks still miss a field", () => {
    const draft = draftWith(["a.mp3", "b.mp3"], { defaultKind: "spiritual_song" })
    expect(setCounts(draft).missing).toBe(2)
    const fixed = setTrackFields(draft, draft.tracks[0]!.id, { language: "hi" })
    expect(setCounts(fixed).missing).toBe(1)
  })
})

function setTrackTitleBlank(draft: SetDraft): SetDraft {
  return patchTrack(draft, draft.tracks[0]!.id, { title: "  " })
}

/** Runs a set against a script; `answers` are given in the order the tracks are sent. */
async function run(start: SetDraft, answers: Array<RowOutcome & { recordingId?: string } | Error | ((track: SetTrack) => RowOutcome & { recordingId?: string })>) {
  let draft = start
  const sent: Array<{ name: string; position: number }> = []
  const stop = await runSet({
    draft: () => draft,
    patch: (id, patch) => {
      draft = patchTrack(draft, id, patch)
    },
    upload: async (track, position) => {
      sent.push({ name: track.fileName, position })
      const answer = answers.shift() ?? { status: "published" as const, recordingId: `rec-${track.fileName}` }
      if (answer instanceof Error) throw answer
      return typeof answer === "function" ? answer(track) : answer
    },
  })
  return { draft, sent, stop }
}

describe("runSet: order, partial success, retry", () => {
  it("sends the tracks in list order, each with its place, and remembers the server ids", async () => {
    const start = draftWith(["a.mp3", "b.mp3", "c.mp3"])
    const reordered = { ...start, tracks: moveTrack(start.tracks, start.tracks[2]!.id, 0) }
    const { draft, sent, stop } = await run(reordered, [])
    expect(stop).toBeNull()
    expect(sent).toEqual([
      { name: "c.mp3", position: 1 },
      { name: "a.mp3", position: 2 },
      { name: "b.mp3", position: 3 },
    ])
    expect(draft.tracks.every((t) => t.status === "done")).toBe(true)
    expect(liveOrder(draft)).toEqual(["rec-c.mp3", "rec-a.mp3", "rec-b.mp3"])
    expect(setState(draft)).toBe("published")
  })

  it("a track that fails does not stop the others; partial success reads as uploading", async () => {
    const start = draftWith(["a.mp3", "b.mp3", "c.mp3"])
    const { draft, stop } = await run(start, [{ status: "published", recordingId: "r1" }, { status: "failed", failure: { code: "server" } }])
    expect(stop).toBeNull()
    expect(draft.tracks.map((t) => t.status)).toEqual(["done", "failed", "done"])
    expect(setState(draft)).toBe("uploading")
    expect(setCounts(draft)).toMatchObject({ live: 2, failed: 1 })
  })

  it("an exception inside one upload fails that track only", async () => {
    const { draft } = await run(draftWith(["a.mp3", "b.mp3"]), [new Error("boom")])
    expect(draft.tracks.map((t) => t.status)).toEqual(["failed", "done"])
  })

  it("a retry sends only the failed track, at its own place, and finishes the set", async () => {
    const first = await run(draftWith(["a.mp3", "b.mp3", "c.mp3"]), [{ status: "published", recordingId: "r1" }, { status: "failed", failure: { code: "server" } }])
    const again = await run(retryTrack(first.draft, first.draft.tracks[1]!.id), [])
    expect(again.sent).toEqual([{ name: "b.mp3", position: 2 }])
    expect(setState(again.draft)).toBe("published")
    expect(liveOrder(again.draft)).toEqual(["r1", "rec-b.mp3", "rec-c.mp3"])
  })

  it("retry all puts every stopped track back in line", async () => {
    const first = await run(draftWith(["a.mp3", "b.mp3"]), [{ status: "failed", failure: { code: "server" } }, { status: "failed", failure: { code: "server" } }])
    expect(first.draft.tracks.map((t) => t.status)).toEqual(["failed", "failed"])
    const again = await run(retryAllTracks(first.draft), [])
    expect(again.draft.tracks.map((t) => t.status)).toEqual(["done", "done"])
  })

  it("no connection stops the run; the track that was going and the rest wait, nothing is marked failed", async () => {
    const start = draftWith(["a.mp3", "b.mp3", "c.mp3"])
    const { draft, sent, stop } = await run(start, [{ status: "published", recordingId: "r1" }, { status: "failed", failure: { code: "network" } }])
    expect(stop).toBe("network")
    expect(sent.map((s) => s.name)).toEqual(["a.mp3", "b.mp3"])
    expect(draft.tracks.map((t) => t.status)).toEqual(["done", "waiting", "waiting"])
    // continuing needs no retry: the next run sends the two that wait
    const next = await run(draft, [])
    expect(next.sent.map((s) => s.name)).toEqual(["b.mp3", "c.mp3"])
    expect(setState(next.draft)).toBe("published")
  })

  it("the daily limit stops the run and the rest stay for tomorrow", async () => {
    const { draft, stop } = await run(draftWith(["a.mp3", "b.mp3", "c.mp3"]), [{ status: "published", recordingId: "r1" }, { status: "failed", failure: { code: "dailyLimit" } }])
    expect(stop).toBe("dailyLimit")
    expect(draft.tracks.map((t) => t.status)).toEqual(["done", "limit", "waiting"])
  })

  it("the per-set daily limit stops the run the same way", async () => {
    const { draft, stop } = await run(draftWith(["a.mp3", "b.mp3"]), [{ status: "failed", failure: { code: "setDailyLimit" } }])
    expect(stop).toBe("dailyLimit")
    expect(draft.tracks.map((t) => t.status)).toEqual(["limit", "waiting"])
  })

  it("a lost sign-in stops the run and keeps the rest waiting", async () => {
    const { draft, stop } = await run(draftWith(["a.mp3", "b.mp3"]), [{ status: "failed", failure: { code: "signin" } }])
    expect(stop).toBe("signin")
    expect(draft.tracks.map((t) => t.status)).toEqual(["failed", "waiting"])
  })

  it("a track that misses its language or has no title is passed over, the others go", async () => {
    let start = draftWith(["a.mp3", "b.mp3", "c.mp3"], { defaultKind: "spiritual_song" })
    start = setTrackFields(start, start.tracks[0]!.id, { language: "hi" })
    start = setTrackFields(start, start.tracks[2]!.id, { language: "bn" })
    const { draft, sent } = await run(start, [])
    expect(sent.map((s) => s.name)).toEqual(["a.mp3", "c.mp3"])
    expect(draft.tracks[1]!.status).toBe("waiting")
  })

  it("a similar-recording answer parks the track until the person decides", async () => {
    const { draft } = await run(draftWith(["a.mp3", "b.mp3"]), [{ status: "similar", key: "k1", similar: [], submissionId: "s" }])
    expect(draft.tracks.map((t) => t.status)).toEqual(["similar", "done"])
    expect(setState(draft)).toBe("uploading")
  })
})

describe("after the app was closed", () => {
  it("a track that was going goes back to waiting; a picked file that cannot survive a reload says so", () => {
    let draft = draftWith(["a.mp3", "b.mp3", "c.mp3"])
    draft = patchTrack(draft, draft.tracks[0]!.id, { status: "uploading" })
    draft = patchTrack(draft, draft.tracks[1]!.id, { status: "uploading", uri: "blob:http://x/1" })
    draft = patchTrack(draft, draft.tracks[2]!.id, { status: "done", recordingId: "r3" })
    const restored = restoreDraft(draft)
    expect(restored.tracks.map((t) => t.status)).toEqual(["waiting", "failed", "done"])
    expect(restored.tracks[1]!.failure).toMatchObject({ code: "gone" })
    expect(restored.tracks[2]!.recordingId).toBe("r3")
  })
  it("a set that never reached the server stays a draft even when its lost files are marked failed", () => {
    let draft = draftWith(["a.mp3", "b.mp3"])
    draft = restoreDraft(patchTrack(patchTrack(draft, draft.tracks[0]!.id, { uri: "blob:http://x/1" }), draft.tracks[1]!.id, { uri: "blob:http://x/2" }))
    expect(draft.tracks.every((t) => t.status === "failed")).toBe(true)
    expect(setState(draft)).toBe("draft")
    expect(setState({ ...draft, created: true })).toBe("uploading")
  })
  it("a cover picked in the browser (a blob address) is dropped on restore, a kept link stays", () => {
    const draft = draftWith(["a.mp3"])
    expect(restoreDraft({ ...draft, coverUri: "blob:http://x/2", coverState: "sent" })).toMatchObject({ coverUri: "", coverState: "none" })
    expect(restoreDraft({ ...draft, coverUri: "file:///cover.jpg", coverState: "pending" })).toMatchObject({ coverUri: "file:///cover.jpg", coverState: "pending" })
  })
})

describe("views of a set", () => {
  const live = (name: string, index: number) => ({ name, index })
  it("a draft's summary says how many are live and how many wait", () => {
    let draft = draftWith(["a.mp3", "b.mp3", "c.mp3"])
    draft = patchTrack(draft, draft.tracks[0]!.id, { status: "done", recordingId: "r1" })
    draft = patchTrack(draft, draft.tracks[1]!.id, { status: "failed", failure: { code: "server" } })
    expect(summaryOfDraft(draft)).toMatchObject({ id: "set-1", title: "Dhanbad retreat", state: "uploading", count: 1, waiting: 2, source: "phone" })
    expect(live("x", 1).name).toBe("x")
  })

  it("the view of a draft keeps only live tracks, numbered in list order, with the set's date and performer", () => {
    let draft = draftWith(["a.mp3", "b.mp3", "c.mp3"], { eventYear: 2026, eventMonth: 11, defaultKind: "bhajan", defaultLanguage: "hi" })
    draft = patchTrack(draft, draft.tracks[0]!.id, { status: "done", recordingId: "r1" })
    draft = patchTrack(draft, draft.tracks[2]!.id, { status: "done", recordingId: "r3", recordedOn: "2026-11-04" })
    const view = viewOfDraft(draft, "Priya")
    expect(view.owner).toBe(true)
    expect(view.tracks.map((t) => [t.id, t.position, t.recordedOn, t.language, t.author])).toEqual([
      ["r1", 1, "2026-11-01", "hi", "Priya Devi"],
      ["r3", 2, "2026-11-04", "hi", "Priya Devi"],
    ])
  })

  const summary = (id: string, state: SetSummary["state"], startsOn: string, source: SetSummary["source"] = "server"): SetSummary => ({ id, title: id, place: null, eventYear: Number(startsOn.slice(0, 4)), eventMonth: Number(startsOn.slice(5, 7)), coverUrl: null, state, count: 1, waiting: 0, source })

  it("unfinished sets come first, then the newest event", () => {
    const list = sortSummaries([summary("old", "published", "2026-01-01"), summary("new", "published", "2026-10-01"), summary("busy", "uploading", "2025-05-05")])
    expect(list.map((s) => s.id)).toEqual(["busy", "new", "old"])
  })

  it("a set kept on the phone wins over the server's copy of the same id", () => {
    const merged = mergeSummaries([summary("a", "published", "2026-10-01"), summary("b", "published", "2026-09-01")], [{ ...summary("a", "uploading", "2026-10-01", "phone"), waiting: 3 }])
    expect(merged.map((s) => [s.id, s.source, s.waiting])).toEqual([
      ["a", "phone", 3],
      ["b", "server", 0],
    ])
  })

  it("when-label is the month and year, or just the year", () => {
    const name = (m: number) => ["", "January", "February", "March"][m] ?? `m${m}`
    expect(whenLabel({ eventYear: 2026, eventMonth: 3 }, name)).toBe("March 2026")
    expect(whenLabel({ eventYear: 2026, eventMonth: null }, name)).toBe("2026")
  })

  it("the share text names the place when there is one", () => {
    const translate = (key: string, vars: Record<string, string | number>) => `${key}|${Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(",")}`
    expect(setShareText({ title: "T", place: " Ranchi ", count: 4, when: "W" }, translate as never)).toBe("set.page.shareWithPlace|title=T,count=4,place=Ranchi,when=W")
    expect(setShareText({ title: "T", place: null, count: 4, when: "W" }, translate as never)).toBe("set.page.shareNoPlace|title=T,count=4,when=W")
  })
})

describe("the files step (QA-039)", () => {
  it("says something different in the empty box and on its button, so 'Choose files' is not shown twice", () => {
    for (const [name, book] of Object.entries({ en: setsEn, ru: setsRu, es: setsEs }) as Array<[string, Record<string, string>]>) {
      expect(book["set.files.empty"]?.trim(), name).toBeTruthy()
      expect(book["set.files.empty"], name).not.toBe(book["set.files.choose"])
    }
  })
})
